export type AnalyticsBuildEnvironment = {
  vercelEnv: string | undefined;
};

export const ANALYTICS_CONTROL_PARAM = 'analytics';
export const ANALYTICS_OPT_OUT_COOKIE = 'jet_analytics_opt_out';

export function shouldEmitProductionAnalytics(
  environment: AnalyticsBuildEnvironment,
): boolean {
  return environment.vercelEnv === 'production';
}
