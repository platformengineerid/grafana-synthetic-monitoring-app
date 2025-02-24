import { faro, isError, isObject } from '@grafana/faro-web-sdk';
import { config } from '@grafana/runtime';

export enum FaroEvent {
  INIT = 'initialize',
  UPDATE_CHECK = 'update_check',
  DELETE_CHECK = 'delete_check',
  TEST_CHECK = 'test_check',
  CREATE_CHECK = 'create_check',
  CREATE_PROBE = 'create_probe',
  UPDATE_PROBE = 'update_probe',
  DELETE_PROBE = 'delete_probe',
  RESET_PROBE_TOKEN = 'reset_probe_token',
  DISABLE_PLUGIN = 'disable_plugin',
  CREATE_ACCESS_TOKEN = 'create_access_token',
  SAVE_THRESHOLDS = 'save_thresholds',
  SHOW_TERRAFORM_CONFIG = 'show_terraform_config',
}

enum FARO_ENV {
  DEV = 'development',
  STAGING = 'staging',
  PROD = 'production',
}

export function pushFaroCount(type: string, count: number) {
  try {
    faro.api.pushMeasurement({ type, values: { count } });
  } catch (e) {}
}

export function reportEvent(type: FaroEvent, options: Record<string, any> = {}) {
  const slug = config.bootData.user.orgName;
  try {
    faro.api.pushEvent(type, { slug });
  } catch (e) {}
}

function sanitizeError(error: Error | Object | string) {
  if (isError(error)) {
    return error;
  }
  if (isObject(error)) {
    return new Error(JSON.stringify(error));
  }
  return new Error(error);
}

export function reportError(error: Error | Object | string, type?: FaroEvent) {
  const valToSend = sanitizeError(error);
  try {
    faro.api.pushError(valToSend, { type });
  } catch (e) {}
}

function getFaroEnv() {
  const appUrl = new URL(config.appUrl).hostname;
  switch (true) {
    case appUrl.endsWith('grafana-ops.net'):
      return FARO_ENV.STAGING;
    case appUrl.endsWith('grafana.net'):
      return FARO_ENV.PROD;
    case appUrl.endsWith('grafana-dev.net'):
    case appUrl.endsWith('localhost'):
    default:
      return FARO_ENV.DEV;
  }
}

export function getFaroConfig() {
  const env = getFaroEnv();
  switch (env) {
    case FARO_ENV.DEV:
      return {
        url: 'https://faro-collector-prod-us-central-0.grafana.net/collect/3de3837f15a92467f2d006f18babc95a',
        name: 'synthetic-monitoring-app-dev',
        env: FARO_ENV.DEV,
      };
    case FARO_ENV.STAGING:
      return {
        url: 'https://faro-collector-prod-us-central-0.grafana.net/collect/d3cccbfcacdb95ae047f2ff40d7fdc30',
        name: 'synthetic-monitoring-app-staging',
        env: FARO_ENV.STAGING,
      };
    case FARO_ENV.PROD:
    default:
      return {
        url: 'https://faro-collector-prod-us-central-0.grafana.net/collect/10f67a43146dd52c0a039b19cd3d1094',
        name: 'synthetic-monitoring-app-prod',
        env: FARO_ENV.PROD,
      };
  }
}
