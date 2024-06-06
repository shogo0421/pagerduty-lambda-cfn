import {
  CloudWatchLogsClient,
  DescribeMetricFiltersCommand,
  FilterLogEventsCommand,
  MetricFilter,
} from "@aws-sdk/client-cloudwatch-logs";
import { Handler, SNSEvent } from "aws-lambda";
import { config } from "dotenv";
import { jsonCheck, postPagerDuty } from "./pagerduty-util";

// 抽出するログデータの最大件数
const OUTPUT_LIMIT = 20;

// 何分前までを抽出対象期間とするか
const TIME_FROM_MIN = 3;

// ERRORの何秒前後のログを出力するか
const TIME_ERROR_AROUND = 30;

const client = new CloudWatchLogsClient();

config();

type SnsMessage = {
  Trigger: {
    MetricName: string;
    Namespace: string;
  };
  StateChangeTime: string;
  AlarmName: string;
};

const getMetricFilters = async (snsMessage: SnsMessage) => {
  console.info(`Message: ${JSON.stringify(snsMessage)}`);

  const describeMetricFiltersCommand = new DescribeMetricFiltersCommand({
    metricName: snsMessage.Trigger.MetricName,
    metricNamespace: snsMessage.Trigger.Namespace,
  });

  const describeMetricFilters = await client.send(describeMetricFiltersCommand);
  console.info(
    `responseMetricFilters: ${JSON.stringify(describeMetricFilters)}`
  );

  if (
    describeMetricFilters.metricFilters == null ||
    describeMetricFilters.metricFilters[0] == null
  )
    throw new Error("MetricFilters is null");

  return describeMetricFilters.metricFilters[0];
};

const getTriggerLogMessage = async (
  snsMessage: SnsMessage,
  filter: MetricFilter
) => {
  // ログストリームの抽出対象時刻をUNIXタイムに変換。終了時刻はアラーム発生時刻の1分後
  const searchEndAt = new Date(snsMessage.StateChangeTime).getTime() + 60000;
  // 開始時刻は終了時刻のTIME_FROM_MIN分前
  const searchStartAt =
    new Date(searchEndAt).getTime() - TIME_FROM_MIN * 60 * 1000;

  const triggerLogEventsCommand = new FilterLogEventsCommand({
    logGroupName: filter.logGroupName ?? "",
    filterPattern: filter.filterPattern ?? "",
    startTime: searchStartAt,
    endTime: searchEndAt,
    limit: OUTPUT_LIMIT,
  });

  const triggerLogEvents = await client.send(triggerLogEventsCommand);
  console.info(`alertTriggerLogEvents: ${JSON.stringify(triggerLogEvents)}`);

  if (triggerLogEvents.events == null || triggerLogEvents.events[0] == null)
    throw new Error("logEvents is null");
  return triggerLogEvents.events[0].message ?? "";
};

const getErrorLogMessage = async (
  triggerLogMessage: string,
  filter: MetricFilter
) => {
  const triggerLog = JSON.parse(triggerLogMessage);
  const errorTime = new Date(triggerLog.timestamp?.toString() ?? "").getTime();

  // エラーのログから前後X秒のログを取得
  const errorStartAt = errorTime - TIME_ERROR_AROUND * 1000;
  const errorEndedAt = errorTime + TIME_ERROR_AROUND * 1000;

  const errorLogRetrieveCommand = new FilterLogEventsCommand({
    logGroupName: filter.logGroupName ?? "",
    startTime: errorStartAt,
    endTime: errorEndedAt,
    filterPattern: `{$.function_request_id = "${triggerLog.function_request_id}"}`,
    limit: OUTPUT_LIMIT,
  });
  const errorLogEvents = await client.send(errorLogRetrieveCommand);

  // PagerDuty連携用にログを整形
  let errorLogMessage = "";
  if (errorLogEvents.events == null) throw new Error("events is null");
  errorLogEvents.events.forEach((errorLog) => {
    errorLogMessage += `${errorLog.message}\n`;
  });
  return errorLogMessage;
};

export const handler: Handler = async (event: SNSEvent) => {
  console.info(`Event: ${JSON.stringify(event)}`);

  /* 
    SNSイベントの起因になったログの取得
  */
  if (event.Records[0] == null) throw new Error("SNSEvent is null");
  const snsMessage = JSON.parse(event.Records[0].Sns.Message);
  const filter = await getMetricFilters(snsMessage);
  const triggerLogMessage = await getTriggerLogMessage(snsMessage, filter);

  /* 
    PagerDuty連携用データの作成
  */
  let messageForIncident = "";
  const summary = `[FilterPattern: ${filter.filterPattern}] ${event.Records[0].Sns.Subject}`;
  const source = snsMessage.AlarmName;
  const timestamp = event.Records[0].Sns.Timestamp;

  const isJson = jsonCheck(triggerLogMessage);
  if (isJson) {
    // エラーと関連した一連のログを取得
    messageForIncident = await getErrorLogMessage(triggerLogMessage, filter);
    await postPagerDuty(summary, source, messageForIncident, timestamp);
  } else {
    // ログがJSON形式でない場合はそのままPagerDutyに通知
    messageForIncident = triggerLogMessage;
    await postPagerDuty(summary, source, messageForIncident, timestamp);
  }
};
