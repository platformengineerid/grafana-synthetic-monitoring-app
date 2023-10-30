import React, { useContext, useState, useMemo, useReducer } from 'react';
import { FormProvider, useForm, Controller, useFieldArray } from 'react-hook-form';
import { useParams } from 'react-router-dom';

import {
  Alert,
  Button,
  ConfirmModal,
  Field,
  LinkButton,
  VerticalGroup,
  Input,
  Select,
  useStyles2,
  Legend,
  HorizontalGroup,
  Checkbox,
} from '@grafana/ui';
import { getDefaultValuesFromCheck, getCheckFromFormValues } from 'components/CheckEditor/checkFormTransformations';
import { ProbeOptions } from 'components/CheckEditor/ProbeOptions';
import { METHOD_OPTIONS } from 'components/constants';
import { MultiHttpCollapse } from 'components/MultiHttp/MultiHttpCollapse';
import { multiHttpFallbackCheck } from './consts';
import { validateTarget } from 'validation';
import { TabSection } from './Tabs/TabSection';
import { getMultiHttpFormStyles } from './MultiHttpSettingsForm.styles';
import { CheckFormValues, Check, CheckPageParams, CheckType, SubmissionErrorWrapper } from 'types';
import { InstanceContext } from 'contexts/InstanceContext';
import { PluginPage } from 'components/PluginPage';
import { config } from '@grafana/runtime';
import { OrgRole } from '@grafana/data';
import { hasRole } from 'utils';
import { AvailableVariables } from './AvailableVariables';
import { useAsyncCallback } from 'react-async-hook';
import { FaroEvent, reportEvent, reportError } from 'faro';
import { CheckFormAlert } from 'components/CheckFormAlert';
import { HorizontalCheckboxField } from 'components/HorizonalCheckboxField';
import { CheckUsage } from 'components/CheckUsage';
import { CheckTestButton } from 'components/CheckTestButton';

interface Props {
  checks?: Check[];
  onReturn?: (reload?: boolean) => void;
}

function reducer(state: boolean[], action: { type: string; index?: number }) {
  switch (action.type) {
    case 'addNewRequest':
      const newState = state.map((isOpen, index) => {
        return false;
      });
      newState.push(true);
      return newState;
    case 'removeRequest':
      return state.filter((_, index) => index !== action.index);
    case 'toggle': {
      return state.map((isOpen, index) => {
        if (action.index === index) {
          return !isOpen;
        }
        return isOpen;
      });
    }
    default:
      return state;
  }
}

export const MultiHttpSettingsForm = ({ checks, onReturn }: Props) => {
  const styles = useStyles2(getMultiHttpFormStyles);
  let check: Check = multiHttpFallbackCheck;
  const { id } = useParams<CheckPageParams>();
  if (id) {
    check = checks?.find((c) => c.id === Number(id)) ?? multiHttpFallbackCheck;
  }
  const {
    instance: { api },
  } = useContext(InstanceContext);
  const defaultValues = useMemo(() => getDefaultValuesFromCheck(check), [check]);
  const [collapseState, dispatchCollapse] = useReducer(
    reducer,
    check.settings.multihttp?.entries?.map((_, index, arr) => index === arr.length - 1) ?? [true]
  );

  const formMethods = useForm<CheckFormValues>({ defaultValues, reValidateMode: 'onBlur' });

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = formMethods;
  const {
    fields: entryFields,
    append,
    remove,
  } = useFieldArray({
    control: formMethods.control,
    name: 'settings.multihttp.entries',
  });
  const isEditor = hasRole(OrgRole.Editor);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const {
    execute: onSubmit,
    error,
    loading: submitting,
  } = useAsyncCallback(async (values: CheckFormValues) => {
    // All other types of SM checks so far require a `target` to execute at the root of the submitted object.
    // This is not the case for multihttp checks, whose targets are called `url`s and are nested under
    // `settings.multihttp?.entries[0].request.url`. Yet, the BE still requires a root-level `target`, even in
    // the case of multihttp, even though it wont be used. So we will pass this safety `target`.values.target = target;
    const target = values.settings.multihttp?.entries?.[0]?.request?.url ?? '';
    if (!target) {
      throw new Error('At least one request with a URL is required');
    }

    const updatedCheck = getCheckFromFormValues(values, defaultValues, CheckType.MULTI_HTTP);

    if (check?.id) {
      reportEvent(FaroEvent.UPDATE_CHECK, { type: CheckType.MULTI_HTTP });
      await api?.updateCheck({
        id: check.id,
        tenantId: check.tenantId,
        ...updatedCheck,
      });
    } else {
      reportEvent(FaroEvent.CREATE_CHECK, { type: CheckType.MULTI_HTTP });
      await api?.addCheck(updatedCheck);
    }
    onReturn && onReturn(true);
  });

  const submissionError = error as unknown as SubmissionErrorWrapper;

  if (submissionError) {
    reportError(
      submissionError.data?.err ?? 'Multihttp submission error',
      check?.id ? FaroEvent.UPDATE_CHECK : FaroEvent.CREATE_CHECK
    );
  }

  const onRemoveCheck = async () => {
    const id = check?.id;
    if (!id) {
      return;
    }
    reportEvent(FaroEvent.DELETE_CHECK, { type: CheckType.MULTI_HTTP });
    await api?.deleteCheck(id);
    onReturn && onReturn(true);
  };

  const requests = watch('settings.multihttp.entries') as any[];

  return (
    <>
      <PluginPage
        pageNav={{
          text: check?.job ? `Editing ${check.job}` : 'Add MULTIHTTP check',
        }}
      >
        {!config.featureToggles.topnav && <Legend>{check?.id ? 'Edit Check' : 'Add MULTIHTTP Check'}</Legend>}
        <VerticalGroup>
          <FormProvider {...formMethods}>
            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
              <hr className={styles.breakLine} />
              <HorizontalCheckboxField
                disabled={!isEditor}
                name="enabled"
                id="check-form-enabled"
                label="Enabled"
                description="If a check is enabled, metrics and logs are published to your Grafana Cloud stack."
              />
              <Field label="Job name" invalid={Boolean(errors.job)} error={errors.job?.message}>
                <Input
                  {...register('job', {
                    required: 'Job name is required',
                    minLength: 1,
                  })}
                  type="text"
                  id="check-editor-job-input"
                  placeholder="Unnamed request"
                  className={styles.jobNameInput}
                />
              </Field>
              <ProbeOptions
                isEditor={isEditor}
                timeout={check?.timeout ?? multiHttpFallbackCheck.timeout}
                frequency={check?.frequency ?? multiHttpFallbackCheck.frequency}
                probes={check?.probes ?? multiHttpFallbackCheck.probes}
                checkType={CheckType.MULTI_HTTP}
              />

              <hr />
              <h3>Requests</h3>
              <Field label="At least one target HTTP is required; limit 10 requests per check.">
                <></>
              </Field>
              <div className={styles.request}>
                {entryFields.map((field, index) => {
                  const urlForIndex =
                    watch(`settings.multihttp.entries.${index}.request.url`) || `Request ${index + 1}`;
                  return (
                    <MultiHttpCollapse
                      label={urlForIndex}
                      key={field.id}
                      className={styles.collapseTarget}
                      invalid={Boolean(errors?.settings?.multihttp?.entries?.[index])}
                      isOpen={collapseState[index]}
                      onToggle={() => dispatchCollapse({ type: 'toggle', index })}
                    >
                      <VerticalGroup height={'100%'}>
                        <HorizontalGroup spacing="lg" align="flex-start">
                          <Field
                            label="Request target"
                            description="Full URL to send request to"
                            invalid={Boolean(errors?.settings?.multihttp?.entries?.[index]?.request?.url)}
                            error={errors?.settings?.multihttp?.entries?.[index]?.request?.url?.message}
                            className={styles.requestTargetInput}
                          >
                            <Input
                              id={`request-target-url-${index}`}
                              {...register(`settings.multihttp.entries.${index}.request.url` as const, {
                                required: 'Request target is required',
                                validate: (url: string) => {
                                  const hasVariable = url.includes('${');
                                  if (hasVariable) {
                                    return undefined;
                                  }
                                  return validateTarget(CheckType.MULTI_HTTP, url);
                                },
                              })}
                            />
                          </Field>
                          <Field
                            label="Request method"
                            description="The HTTP method used"
                            invalid={Boolean(errors?.settings?.multihttp?.entries?.[index]?.request?.method)}
                            error={errors?.settings?.multihttp?.entries?.[index]?.request?.method?.message}
                          >
                            <Controller
                              name={`settings.multihttp.entries.${index}.request.method`}
                              render={({ field }) => (
                                <Select {...field} options={METHOD_OPTIONS} data-testid="request-method" />
                              )}
                              rules={{ required: 'Request method is required' }}
                            />
                          </Field>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              remove(index);
                              dispatchCollapse({ type: 'removeRequest', index });
                            }}
                            className={styles.removeRequestButton}
                          >
                            Remove
                          </Button>
                        </HorizontalGroup>

                        <AvailableVariables index={index} />

                        <Field
                          label="Log response body"
                          description="Will add a log line that gets sent to Loki containing the response body. Be mindful of large response bodies or whether the response contains sensitive information."
                          invalid={Boolean(errors?.settings?.multihttp?.entries?.[index]?.logResponse)}
                          error={errors?.settings?.multihttp?.entries?.[index]?.logResponse?.message}
                        >
                          <Checkbox {...register(`settings.multihttp.entries.${index}.logResponse`)} />
                        </Field>
                        <TabSection index={index} />
                      </VerticalGroup>
                    </MultiHttpCollapse>
                  );
                })}

                <Button
                  type="button"
                  fill="text"
                  size="md"
                  icon="plus"
                  disabled={requests?.length > 9}
                  tooltip={requests?.length > 9 ? 'Maximum of 10 requests per check' : undefined}
                  tooltipPlacement="bottom-start"
                  onClick={() => {
                    append({});
                    dispatchCollapse({ type: 'addNewRequest' });
                  }}
                  className={styles.addRequestButton}
                >
                  Add request
                </Button>
                <CheckUsage />
                <CheckFormAlert />
                {submissionError && (
                  <Alert title="Multihttp request creation failed" severity="error">
                    <div>{submissionError?.data?.err || submissionError?.data?.msg || submissionError?.message}</div>
                  </Alert>
                )}
                <HorizontalGroup height="40px">
                  <Button type="submit" disabled={formMethods.formState.isSubmitting || submitting}>
                    Save
                  </Button>
                  <CheckTestButton check={check} />
                  {check?.id && (
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteModal(true)}
                      disabled={!isEditor}
                      type="button"
                    >
                      Delete Check
                    </Button>
                  )}
                  <LinkButton onClick={() => onReturn && onReturn(true)} fill="text">
                    Cancel
                  </LinkButton>
                </HorizontalGroup>
              </div>
            </form>
          </FormProvider>
        </VerticalGroup>
        <ConfirmModal
          isOpen={showDeleteModal}
          title="Delete check"
          body="Are you sure you want to delete this check?"
          confirmText="Delete check"
          onConfirm={onRemoveCheck}
          onDismiss={() => setShowDeleteModal(false)}
        />
      </PluginPage>
    </>
  );
};
