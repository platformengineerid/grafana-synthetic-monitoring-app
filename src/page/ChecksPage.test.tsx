import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { render } from 'test/render';

import { ROUTES } from 'types';
import { PLUGIN_URL_PATH } from 'components/constants';

import { CheckRouter } from './CheckRouter';

jest.setTimeout(20000);

const renderChecksPage = (multiHttpEnabled = false) => {
  const featureToggles = { 'multi-http': multiHttpEnabled };

  return waitFor(() =>
    render(<CheckRouter />, {
      featureToggles,
      path: `${PLUGIN_URL_PATH}${ROUTES.Checks}`,
      route: `${PLUGIN_URL_PATH}${ROUTES.Checks}`,
    })
  );
};

test('renders checks', async () => {
  await renderChecksPage();
  await waitFor(() => expect(screen.getByText('a jobname')).toBeInTheDocument());
});

test('renders check selection page with multi-http feature flag is ON', async () => {
  const { user } = await renderChecksPage(true);
  await waitFor(() => screen.getByRole('button', { name: 'Add new check' }));
  await user.click(screen.getByRole('button', { name: 'Add new check' }));
  expect(await screen.findByRole('button', { name: 'HTTP' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: /MULTIHTTP/ })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Traceroute' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'PING' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'DNS' })).toBeInTheDocument();
});

test('renders check selection page without multi-http feature flag is OFF', async () => {
  const { user } = await renderChecksPage(false);
  await waitFor(() => screen.getByRole('button', { name: 'Add new check' }));
  await user.click(screen.getByRole('button', { name: 'Add new check' }));
  expect(await screen.queryByRole('button', { name: 'HTTP' })).toBeInTheDocument();
  expect(await screen.queryByRole('button', { name: 'Traceroute' })).toBeInTheDocument();
  expect(await screen.queryByRole('button', { name: 'PING' })).toBeInTheDocument();
  expect(await screen.queryByRole('button', { name: 'DNS' })).toBeInTheDocument();
  expect(await screen.queryByRole('button', { name: /MULTIHTTP/ })).not.toBeInTheDocument();
});

test('renders check editor existing check', async () => {
  const { user } = await renderChecksPage();
  const edit = await screen.findByTestId('edit-check-button');
  await user.click(edit);
  await waitFor(() => expect(screen.getByText('Editing a jobname')).toBeInTheDocument());
});
