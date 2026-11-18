import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import ImpactTime from './ImpactTime/ImpactTime.svelte';
import ImpactGeo from './ImpactGeo/ImpactGeo.svelte';
import UnavoidableRisk from '../../components/UnavoidableRisk/UnavoidableRisk.svelte';

afterEach(cleanup);

test.each([
  ['timing', ImpactTime],
  ['map', ImpactGeo],
  ['warming', UnavoidableRisk],
].flatMap(([name, component]) => ['indicatorScope', 'availability'].map((failedRequest) => ({ name, component, failedRequest }))))(
  '$name chart offers one recovery action when $failedRequest fails',
  async ({ component, failedRequest }) => {
    const retryAvailability = vi.fn();
    const chartContext = { view: { status: 'failure', failedRequest }, scenarios: [], allScenarios: [] };
    const view = render(component, { chartContext, retryAvailability });

    const placeholder = screen.getByRole('alert');
    const retry = within(placeholder).getByRole('button', { name: 'Retry', exact: true });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.click(retry);
    expect(retryAvailability).toHaveBeenCalledTimes(1);

    await view.rerender({ chartContext: { ...chartContext, view: { status: 'loading' } }, retryAvailability });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  }
);
