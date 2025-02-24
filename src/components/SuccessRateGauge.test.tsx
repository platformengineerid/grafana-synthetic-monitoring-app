import React from 'react';
import { screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { createInstance, render } from 'test/render';

import { Check } from 'types';
import * as utils from 'utils';
import { SuccessRateTypes } from 'contexts/SuccessRateContext';

import { SuccessRateContextProvider } from './SuccessRateContextProvider';
import { SuccessRateGauge } from './SuccessRateGauge';

const renderSuccessRateGauge = () => {
  const instance = createInstance();
  instance.api.listChecks = jest
    .fn()
    .mockResolvedValue([{ id: 4, job: 'burritos', target: 'tacos', settings: { http: {} } } as Check]);
  return waitFor(() =>
    render(
      <SuccessRateContextProvider>
        <SuccessRateGauge
          title="Reachability"
          id={4}
          type={SuccessRateTypes.Checks}
          height={200}
          width={200}
          onClick={jest.fn()}
        />
      </SuccessRateContextProvider>,
      { instance }
    )
  );
};
test('shows a value if data', async () => {
  await renderSuccessRateGauge();
  await waitForElementToBeRemoved(() => screen.queryByText('loading...'));
  const value = await screen.findByText('100%');
  expect(value).toBeInTheDocument();
});

test('shows N/A if no data', async () => {
  jest.spyOn(utils, 'queryMetric').mockImplementation(() =>
    Promise.resolve({
      data: [
        {
          metric: {
            job: 'burritos',
            instance: 'tacos',
          },
          value: [],
        },
      ],
    })
  );
  await renderSuccessRateGauge();
  await waitForElementToBeRemoved(() => screen.queryByText('loading...'));
  const value = await screen.findByText('N/A');
  expect(value).toBeInTheDocument();
});
