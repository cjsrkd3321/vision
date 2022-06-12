export type SecurityGroupType = 'REF' | 'IP';

export const listInstancesWithSgQuery = (sgId: string) => {
  return `
      WITH records AS (
          SELECT substring(RECORD.name, 1, char_length(RECORD.name) - 1) as name, RECORD.type as type, RECORD.records ->> 0 as domain
          FROM aws_route53_zone as ZONE
          JOIN aws_route53_record AS RECORD ON ZONE.id = RECORD.zone_id
          WHERE
              RECORD.type = 'CNAME' or RECORD.type = 'A'
      )
      SELECT 
          ACCOUNT.account_aliases ->> 0 AS alias,
          EC2.region,
          'EC2' AS "type",
          EC2.title AS "title",
          null AS record,
          null AS dns_name,
          null AS protocol, 
          null AS port, 
          EC2.private_ip_address AS private_ip,
          EC2.public_ip_address AS public_ip
      FROM 
          aws_ec2_instance AS EC2
          JOIN aws_account AS ACCOUNT ON ACCOUNT.account_id = EC2.account_id,
          jsonb_array_elements(security_groups) AS sg
      WHERE  
          sg ->> 'GroupId' = '${sgId}'
          AND instance_state = 'running'
  
      UNION ALL
  
      SELECT 
          ACCOUNT.account_aliases ->> 0 AS alias,
          ALB.region, 
          'ALB' AS "type",
          ALB.title AS "title",
          ALB.dns_name AS record,
          records.name AS dns_name, 
          LISTENER.protocol, 
          LISTENER.port, 
          null AS private_ip,
          null AS public_ip
      FROM
          aws_ec2_application_load_balancer AS ALB
          JOIN aws_account AS ACCOUNT ON ACCOUNT.account_id = ALB.account_id
          JOIN aws_ec2_load_balancer_listener AS LISTENER ON ALB.arn = LISTENER.load_balancer_arn
          JOIN records ON records.domain = ALB.dns_name,
          jsonb_array_elements_text(security_groups) AS sg
      WHERE  
          sg = '${sgId}'
      `;
};

export const getSgWithAlbArnQuery = (sgType: SecurityGroupType, albArn: string) => {
  return `
    WITH sg AS (
        SELECT group_id, tags
        FROM aws_vpc_security_group
    )
    SELECT
        ALB.account_id,
        ALB_SG AS sg_id
    FROM
        aws_ec2_application_load_balancer AS ALB,
        jsonb_array_elements_text(ALB.security_groups) AS ALB_SG
        JOIN sg AS SG ON sg.group_id = ALB_SG
    WHERE
        ALB.state_code = 'active'
        AND ALB.arn = '${albArn}'
        AND SG.tags ->> 'Type' = '${sgType}'
    LIMIT 1
    `;
};

export const getSgWithInstanceIdQuery = (
  sgType: SecurityGroupType,
  instanceId: string
) => {
  return `
    WITH sg AS (
        SELECT group_id, tags
        FROM aws_vpc_security_group
    )
    SELECT
        EC2.account_id,
        EC2_SG ->> 'GroupId' as sg_id
    FROM
        aws_ec2_instance AS EC2,
        jsonb_array_elements(EC2.security_groups) AS EC2_SG
        JOIN sg AS SG ON sg.group_id = EC2_SG ->> 'GroupId'
    WHERE
        EC2.instance_state = 'running'
        AND EC2.instance_id = '${instanceId}'
        AND SG.tags ->> 'Type' = '${sgType}'
    LIMIT 1
    `;
};

export const getSgWithNlbArnQuery = (sgType: SecurityGroupType, nlbArn: string) => {
  return `
        WITH sg AS (
            SELECT EC2.instance_id, SG.group_id
            FROM 
                aws_ec2_instance AS EC2,
                jsonb_array_elements(EC2.security_groups) AS EC2_SG
                JOIN aws_vpc_security_group AS SG ON SG.group_id = EC2_SG ->> 'GroupId'
            WHERE SG.tags ->> 'Type' = '${sgType}'
        )
        SELECT
            NLB.account_id,
            SG.group_id AS sg_id
        FROM
            aws_ec2_network_load_balancer AS NLB
            JOIN aws_ec2_target_group AS TG ON NLB.arn = TG.load_balancer_arns ->> 0,
            jsonb_array_elements(target_health_descriptions) AS TGS
            JOIN sg AS SG ON sg.instance_id = TGS -> 'Target' ->> 'Id'
        WHERE
            NLB.state_code = 'active'
            AND NLB.arn = '${nlbArn}'
        LIMIT 1
    `;
};

export const getVpcPeeringInfoQuery = (firstVpcId: string, secondVpcId: string) => {
  return `
    SELECT
        region
    FROM
        aws_vpc_peering_connection
    WHERE
        (
            (requester_vpc_id = '${firstVpcId}'
            OR accepter_vpc_id = '${secondVpcId}')
        OR
            (requester_vpc_id = '${secondVpcId}'
            OR accepter_vpc_id = '${firstVpcId}')
        )
        AND status_code = 'active'
  `;
};

interface SecurityGroupInfo {
  accountId: string;
  region: string;
  sgId: string;
  protocol: string;
  port: number;
  source: string;
}
export const getSecurityGroupInfo = ({
  accountId,
  region,
  sgId,
  protocol,
  port,
  source,
}: SecurityGroupInfo) => {
  return `
    SELECT 
        account_id, 
        region, 
        group_id AS sg_id, 
        security_group_rule_id AS sgr_id 
    FROM 
        aws_vpc_security_group_rule 
    WHERE 
        account_id = '${accountId}' 
        AND region = '${region}' 
        AND ip_protocol = '${protocol.toLowerCase()}' 
        AND ${source.startsWith('sg-') ? `referenced_group_id = '${source}'` : `cidr_ipv4 = '${source}'`}
        AND group_id = '${sgId}' 
        AND to_port = ${port} 
        AND from_port = ${port}
    `;
};

export type InstanceType = 'EC2' | 'ALB' | undefined;
export interface RefSgWithUniqueId {
  client: any;
  sgType: SecurityGroupType;
  instanceType: InstanceType;
  uniqueId: string;
}
export const getSgWithUniqueId = async ({
  client,
  sgType,
  instanceType,
  uniqueId,
}: RefSgWithUniqueId) => {
  if (!client || !sgType || !instanceType || !uniqueId) return null;

  let result = null;
  if (instanceType === 'EC2') {
    [result] = (await client.query(getSgWithInstanceIdQuery(sgType, uniqueId))).rows;
  } else if (instanceType === 'ALB') {
    [result] = (await client.query(getSgWithAlbArnQuery(sgType, uniqueId))).rows;
  } else if (instanceType === 'NLB') {
    [result] = (await client.query(getSgWithNlbArnQuery(sgType, uniqueId))).rows;
  } else {
    return null;
  }

  return result;
};