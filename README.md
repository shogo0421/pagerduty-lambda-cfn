# PagerDuty連携用Lambda CFNテンプレート

PagerDutyと連携するLambdaをデプロイしてくれるCFNテンプレートを生成するためのCDKプロジェクト

## 目的

クイック作成リンクを作るために、CFNテンプレートをS3に配置する

## 前提

以下のようなアラート通知がすでに実装されているプロジェクトが対象

- CloudWatch Logs + メトリクスフィルターでエラーログを検知している
- AWS SNSを通してエラー通知をSlackなどに連携している
- リージョンが東京か大阪(現時点)

## コマンド

- `build:handler` Lambda関数のスクリプトをビルド
- `upload:handler` Lambda関数のビルド生成物をS3に配置
- `build:cdk` CDKからCFNテンプレートを生成
- `upload:cfn` CFNテンプレートをS3に配置

## クイック作成リンク

以下のリンクを開いて、PagerDutyを導入したいAWS環境の権限を持ったロールに切り替える。

https://ap-northeast-1.console.aws.amazon.com/cloudformation/home?region=ap-northeast-1#/stacks/create/review?templateURL=https://quick-create-cfn-template.s3.ap-northeast-1.amazonaws.com/PagerdutyLambdaCdkStack.template.json&stackName=PagerdutyLambdaCdkStack&param_pagerDutyIntegrationKey=[~]&param_pagerDutyIntegrationUrl=[~]&param_errorTopicArn=[~]

3つのパラメータを入力して、IAMリソースに関するチェックボックスにチェックをいれる。  
作成ボタンを押す

pagerDutyIntegrationKey : pagerDutyのインテグレーションキー  
pagerDutyIntegrationUrl : pagerDutyのインテグレーションURL  
errorTopicArn : エラー発報用のSNSトピックのARN

## テスト

CloudWatch Logs上に手動でイベントログを作成します。

1. CloudWatch Logsを開いて、エラー発報用のメトリクスフィルターが設定されたロググループを選択
2. 適当なログストリームを開いて「ログイベントを作成」を選択
3. 「test ERROR」などメトリクスフィルターに引っかかる文字を含むログを作成

   (ERRORとErrorなど大文字と小文字でメトリクスフィルターの設定と違っていても反応しないので注意)

4. 数分(メトリクス生成の時間間隔分)待つとPagerDuty上でインシデント作成される

   PagerDutyのスマホアプリを入れていると通知が来る

## CDKの更新時

「CFNテンプレートを更新してS3に配置」

- cdkのコードを変更した後、`build:cdk`でビルド
- CFNテンレート(cdk/cdk.out/PagerdutyLambdaCdkStack.template.json)からBootstrapVersionというパラメータ、それと関連する箇所を手動で削除  
  (BootstrapVersionはCDKからのデプロイ時に利用され、今回はCloudFormationからデプロイのため不要)
- `upload:cfn`でCFNテンプレートをS3バケット(s3://quick-create-cfn-template)に配置

## Lambda関数の更新

「Lambdaのスクリプトを更新してS3に配置」

- lambdaのコードを変更した後、`build:cdk`でビルド
  (依存ライブラリも一緒にバンドルされる)
- `upload:handler`でS3にビルド生成物を配置

## デプロイできるリージョンについて

クイック作成リンクを使ってLambda関数をデプロイする場合、Lambdaのスクリプト(ビルド生成物)はs3バケットに配置する。しかし、Lambdaのデプロイ先のリージョンと、Lambdaのスクリプトが配置されたs3バケットのリージョンが、一致していないとデプロイに失敗する。

現在は東京リージョンと大阪リージョンのS3バケットに、Lambdaスクリプトを配置済み  
それ以外のリージョンでも利用する場合は、他のリージョンにもS3バケットを作成して、Lambdaスクリプトを配置する必要がある

- 以下の名前で新しいリージョンにバケットを作成  
  s3://pagerduty-lambda-handler-${リージョン名}
- 既存のバケットを参考にバケットポリシーをアタッチ
- handler/package.jsonのスクリプトを更新する
- `upload:handler`で新しいリージョンのバケットにもスクリプト配置
