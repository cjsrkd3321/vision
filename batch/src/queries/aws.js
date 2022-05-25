export const SG_SERVER_EC2 = `
  SELECT 
    account_id, 
    region,
    instance_id,
    title, 
    private_ip_address as private_ip, 
    public_ip_address as public_ip, 
    instance_state as state, 
    security_groups as sg
  FROM 
    aws_ec2_instance
  WHERE
    instance_state = 'running'
`;

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
