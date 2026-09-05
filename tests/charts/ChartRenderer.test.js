import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, test } from 'vitest';
import ChartRenderer from '../../src/lib/components/charts/DashboardChart/ChartRenderer.svelte';
import DashboardChart from '../../src/lib/components/charts/DashboardChart/DashboardChart.svelte';
import { barContract, lineContract, scatterContract, tableContract } from './fixtures';

describe('ChartRenderer', () => {
  test('renders grouped lines and their range as one chart', () => {
    render(ChartRenderer, { contract: lineContract() });
    expect(screen.getByRole('img', { name: 'Value by Year' })).toBeInTheDocument();
    expect(screen.getByText('SSP1')).toBeInTheDocument();
    expect(screen.getByText('SSP2')).toBeInTheDocument();
    expect(screen.getByLabelText('SSP1 range')).toBeInTheDocument();
  });

  test('renders grouped positive and negative bars with useful labels', () => {
    render(ChartRenderer, { contract: barContract() });
    expect(screen.getByLabelText('DEU, SSP1: 12 %')).toBeInTheDocument();
    expect(screen.getByLabelText('FRA, SSP1: −3 %')).toBeInTheDocument();
  });

  test('shows a scatter point tooltip from keyboard focus and drops incomplete points', async () => {
    render(ChartRenderer, { contract: scatterContract() });
    const point = screen.getByLabelText('DEU — Exposure: 10 %, Investment: 20 €');
    await fireEvent.focus(point);
    expect(screen.getByRole('tooltip')).toHaveTextContent('DEU — Exposure: 10 %, Investment: 20 €');
    expect(screen.queryByText('ESP — Exposure')).not.toBeInTheDocument();
  });

  test('renders the table through its user-facing columns and row headers', () => {
    render(ChartRenderer, { contract: tableContract() });
    expect(screen.getByRole('columnheader', { name: 'Geography' })).toBeInTheDocument();
    expect(screen.getAllByRole('rowheader', { name: 'DEU' })).toHaveLength(2);
    expect(screen.getByRole('cell', { name: '12 %' })).toBeInTheDocument();
  });

  test('shows a clear empty state', () => {
    const contract = lineContract();
    contract.data.values = [];
    render(ChartRenderer, { contract });
    expect(screen.getByText('There is no data for this chart')).toBeInTheDocument();
  });
});

describe('DashboardChart', () => {
  test('shows the contract error before reading chart metadata', () => {
    render(DashboardChart, {
      definition: {
        id: 'scenario-pathways',
        title: 'Scenario pathways',
        type: 'line',
        dimensions: ['indicator', 'year', 'scenario'],
      },
      contract: {},
    });
    expect(screen.getByText('Chart data is not valid')).toBeInTheDocument();
  });

  test('uses ChartFrame copy, notes, and data download actions', () => {
    render(DashboardChart, {
      definition: {
        id: 'scenario-pathways',
        title: 'Scenario pathways',
        description: 'Projected change by scenario.',
        type: 'line',
        dimensions: ['indicator', 'year', 'scenario'],
      },
      contract: lineContract(),
      actions: {
        uid: 'dashboard-chart',
        params: { hazard: 'heat-stress', sector: 'health', chart: 'scenario-pathways' },
        base: '/api',
        arrayFormat: 'repeat',
      },
    });
    expect(screen.getByRole('heading', { name: 'Scenario pathways' })).toBeInTheDocument();
    expect(screen.getByText('Projected change by scenario.')).toBeInTheDocument();
    expect(screen.getByText('About the data')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download data' })).toHaveAttribute('href', expect.stringContaining('/api/dashboard-chart/'));
  });
});
