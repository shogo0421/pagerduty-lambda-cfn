# PagerDuty連携用Lambda CFNテンプレート

PagerDutyと連携するLambdaをデプロイしてくれるCFNテンプレートを生成するためのCDKプロジェクト

## 目的

クイック作成リンクを作るために、CFNテンプレートをS3に配置する

## 前提

以下のようなアラート通知がすでに実装されているプロジェクトが対象

- CloudWatch Logs + メトリクスフィルターでエラーログを検知している
- AWS SNSを通してエラー通知をSlackなどに連携している

## コマンド

- `build:handler` Lambda関数のスクリプトをビルド
- `upload:handler` Lambda関数のビルド生成物をS3に配置
- `build:cdk` CDKからCFNテンプレートを生成
- `upload:cfn` CFNテンプレートをS3に配置

デプロイ時には、CFNテンプレートとLambdaのスクリプトをS3に配置します。
CDKをビルド後、CFNテンレートからBootstrapVersionというパラメータを手動で削除しています。
(BootstrapVersionはCDKからのデプロイ時に利用されるが、今回はCloudFormationからデプロイすることが目的のため)

## クイック作成リンク

以下のリンクを開いて、PagerDutyを導入したいAWS環境の権限を持ったロールに切り替える。

https://ap-northeast-1.console.aws.amazon.com/cloudformation/home?region=ap-northeast-1#/stacks/create/review?templateURL=https://quick-create-cfn-template.s3.ap-northeast-1.amazonaws.com/PagerdutyLambdaCdkStack.template.json&stackName=PagerdutyLambdaCdkStack&param_pagerDutyIntegrationKey=[~]&param_pagerDutyIntegrationUrl=[~]&param_errorTopicArn=[~]

3つのパラメータを入力して、IAMリソースに関するチェックボックスにチェックをいれる。  
作成ボタンを押す

pagerDutyIntegrationKey : pagerDutyのインテグレーションキー  
pagerDutyIntegrationUrl : pagerDutyのインテグレーションURL  
errorTopicArn : エラー発報用のSNSトピックのARN

## テスト

マネジメントコンソールでCloudWatch Logsを開き、「イベントログを作成」を押す  
「test ERROR」などメトリクスフィルターに引っかかる文字を含むログを作成  
数分(メトリクス生成の時間間隔分)待つとにPagerDutyから通知が来る
