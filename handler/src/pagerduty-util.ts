/* eslint-disable no-console */
import axios from "axios";

export const postPagerDuty = async (
  summary: string,
  source: string,
  message: string,
  timestamp: string
) => {
  try {
    const headers = {
      "Content-Type": "application/json",
    };

    const body = {
      payload: {
        summary,
        severity: "critical",
        source,
        custom_details: {
          message,
        },
        timestamp,
      },
      routing_key: process.env?.["PAGER_DUTY_INTEGRATION_KEY"] ?? "",
      event_action: "trigger",
    };

    // PagerDutyへ通知
    const bodyObj = JSON.stringify(body);
    const response = await axios.post(
      process.env?.["PAGER_DUTY_INTEGRATION_URL"] ?? "",
      bodyObj,
      { headers }
    );
    console.info(response.data);
  } catch (err) {
    console.error("PagerDutyへの連携でエラーが発生", err as Error);
  }
};

export const jsonCheck = (jsonString: string): boolean => {
  try {
    JSON.parse(jsonString);
    return true;
  } catch (e) {
    return false;
  }
};
