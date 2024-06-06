import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class PagerdutyLambdaCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const errorTopicArn = new cdk.CfnParameter(this, "errorTopicArn", {
      type: "String",
      description: "ARN of SNS topic for error alert",
    });

    const pagerDutyIntegrationKey = new cdk.CfnParameter(
      this,
      "pagerDutyIntegrationKey",
      {
        type: "String",
        description: "pagerDutyIntegrationKey",
      }
    );

    const pagerDutyIntegrationUrl = new cdk.CfnParameter(
      this,
      "pagerDutyIntegrationUrl",
      {
        type: "String",
        description: "pagerDutyIntegrationUrl",
      }
    );

    const errorTopic = cdk.aws_sns.Topic.fromTopicArn(
      this,
      "ErrorTopic",
      errorTopicArn.valueAsString
    );

    const region = cdk.Stack.of(this).region;

    const codeBucket = cdk.aws_s3.Bucket.fromBucketArn(
      this,
      "CodeBucket",
      `arn:aws:s3:::pagerduty-lambda-handler-${region}`
    );

    const errorNotificationLambda = new cdk.aws_lambda.Function(
      this,
      "PagerDutyLambda",
      {
        functionName: "PagerDutyLambda",
        description: "アラートをPagerDutyと連携するLambda",
        architecture: cdk.aws_lambda.Architecture.ARM_64,
        code: cdk.aws_lambda.Code.fromBucket(codeBucket, "index.zip"),
        handler: "index.handler",
        runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
        environment: {
          PAGER_DUTY_INTEGRATION_KEY: pagerDutyIntegrationKey.valueAsString,
          PAGER_DUTY_INTEGRATION_URL: pagerDutyIntegrationUrl.valueAsString,
        },
      }
    );

    errorNotificationLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["logs:DescribeMetricFilters", "logs:FilterLogEvents"],
        resources: ["*"],
      })
    );

    errorTopic.addSubscription(
      new cdk.aws_sns_subscriptions.LambdaSubscription(errorNotificationLambda)
    );
  }
}
