connection "aws_all" {
  plugin      = "aws"
  type        = "aggregator"
  connections = ["aws_master", "aws_sub1"]

  ignore_error_codes = ["AccessDenied", "AccessDeniedException", "NotAuthorized", "UnauthorizedOperation", "UnrecognizedClientException", "AuthorizationError"]
}

connection "aws_master" {
  plugin  = "aws"
  profile = "default"
  regions = ["ap-northeast-2", "us-east-1"]

  options "connection" {
    cache     = false # true, false
    cache_ttl = 300  # expiration (TTL) in seconds
  }

  ignore_error_codes = ["AccessDenied", "AccessDeniedException", "NotAuthorized", "UnauthorizedOperation", "UnrecognizedClientException", "AuthorizationError"]
}

connection "aws_sub1" {
  plugin    = "aws"
  profile   = "sub1"
  regions   = ["ap-northeast-2", "us-east-1"]

  options "connection" {
    cache     = false # true, false
    cache_ttl = 300  # expiration (TTL) in seconds
  }

  ignore_error_codes = ["AccessDenied", "AccessDeniedException", "NotAuthorized", "UnauthorizedOperation", "UnrecognizedClientException", "AuthorizationError"]
}