export const SG_SERVER_EC2 = `
  SELECT 
    account_id, 
    region,
    instance_id,
    title, 
    private_ip_address as private_ip, 
    public_ip_address as public_ip, 
    instance_state as state, 
    vpc_id,
    security_groups as sg
  FROM 
    aws_ec2_instance
  WHERE
    instance_state = 'running'
`;

// FIXME: LB 관련 쿼리 수정 필요
// export const SG_LB_NLB = `
//   WITH records AS (
//     SELECT RECORD.name as name, RECORD.type as type, RECORD.records ->> 0 as domain
//     FROM aws_route53_zone as ZONE
//     JOIN aws_route53_record AS RECORD ON ZONE.id = RECORD.zone_id
//     WHERE
//         RECORD.type = 'CNAME' or RECORD.type = 'A'
//   )
//   SELECT NLB.account_id, NLB.region, NLB.name, NLB.dns_name as record, records.name as dns_name, NLB.state_code
//   FROM aws_ec2_network_load_balancer as NLB
//     JOIN records ON records.domain = NLB.dns_name
//   WHERE NLB.state_code = 'active'

//   UNION

//   SELECT NLB.account_id, NLB.region, NLB.name, NLB.dns_name as record, records.name as dns_name, NLB.state_code
//   FROM aws_ec2_network_load_balancer as NLB
//     LEFT OUTER JOIN records ON records.domain = NLB.dns_name
//   WHERE NLB.state_code = 'active'
// `;

// export const SG_LB_ALB = `
//   WITH records AS (
//     SELECT RECORD.name as name, RECORD.type as type, RECORD.records ->> 0 as domain
//     FROM aws_route53_zone as ZONE
//     JOIN aws_route53_record AS RECORD ON ZONE.id = RECORD.zone_id
//     WHERE
//         RECORD.type = 'CNAME' or RECORD.type = 'A'
//   )
//   SELECT ALB.account_id, ALB.region, ALB.name, ALB.dns_name as record, records.name as dns_name, ALB.state_code
//   FROM aws_ec2_application_load_balancer as ALB
//     JOIN records ON records.domain = ALB.dns_name
//   WHERE ALB.state_code = 'active'

//   UNION

//   SELECT ALB.account_id, ALB.region, ALB.name, ALB.dns_name as record, records.name as dns_name, ALB.state_code
//   FROM aws_ec2_application_load_balancer as ALB
//     LEFT OUTER JOIN records ON records.domain = ALB.dns_name
//   WHERE ALB.state_code = 'active'
// `;

// // Account

// // // IAM
// export const IAM_NoMfaUser = `
//   SELECT
//     user_arn,
//     password_enabled,
//     mfa_active
//   FROM
//     aws_iam_credential_report
//   WHERE mfa_active IS false
// `;
// export const IAM_RootAcessKey = `
//   SELECT
//     account_id,
//     account_access_keys_present as root_access_key_count
//   FROM
//     aws_iam_account_summary
//   WHERE account_access_keys_present > 0
// `;

// // VPC
// export const VPC_SgIngressAnyOpen = `
//   SELECT
//     account_id as account,
//     group_id,
//     group_name,
//     security_group_rule_id,
//     ip_protocol as protocol,
//     CASE
//       WHEN cidr_ip IS NULL
//       THEN cidr_ipv6
//       ELSE cidr_ip
//       END AS ip,
//     CASE
//       WHEN from_port = to_port
//       THEN from_port::varchar
//       ELSE from_port::varchar || '-' || to_port::varchar
//       END AS port
//   FROM
//     aws_vpc_security_group_rule
//   WHERE
//     type = 'ingress'
//     and (cidr_ip = '0.0.0.0/0' or cidr_ipv6 = '::/0')
// `;

// // // // EC2
// export const EC2_OptionalImds = `
//   SELECT
//     arn,
//     instance_id,
//     metadata_options ->> 'HttpTokens' as HttpTokens,
//     metadata_options ->> 'HttpPutResponseHopLimit' as HopLimit
//   FROM
//     aws_ec2_instance
//   WHERE
//     metadata_options ->> 'HttpEndpoint' = 'enabled'
// `;
// export const EC2_PublicIp = `
//   SELECT
//     arn,
//     instance_id,
//     private_ip_address,
//     public_ip_address
//   FROM
//     aws_ec2_instance
//   WHERE
//     public_ip_address IS NOT null
// `;
// export const EC2_EbsNotEncrypt = `
//   SELECT
//     account_id,
//     region,
//     default_ebs_encryption_enabled,
//     default_ebs_encryption_key
//   FROM
//     aws_ec2_regional_settings
//   WHERE
//     default_ebs_encryption_enabled IS false
// `;

// // // // KMS
// export const KMS_NoRotateKey = `
//   SELECT
//     account_id,
//     jsonb_array_elements(aliases) ->> 'AliasName' as alias_name,
//     enabled,
//     id,
//     key_rotation_enabled,
//     key_manager
//   FROM
//     aws_kms_key
//   WHERE
//     key_manager != 'AWS'
//     AND key_rotation_enabled IS false
// `;
