import type { BarVariables, ChartSeries, Definition } from './types';

export function chartSeries(data: Definition['data'], chartType: string): ChartSeries {
  if (!Array.isArray(data.variables) || !data.variables.length) {
    throw new Error('Chart variables are required.');
  }
  const reference = (variable: string, label?: string) => ({
    variable,
    ...(data.model ? { model: data.model } : {}),
    ...(data.unitFallback ? { unitFallback: data.unitFallback } : {}),
    ...(label ? { label } : {}),
  });
  const select = (name: string | undefined) => {
    const matches = data.variables.filter((variable) => variable.split('|').includes(name ?? ''));
    if (!name || matches.length !== 1) throw new Error(`Role "${name ?? ''}" must match exactly one variable as a whole subsegment.`);
    return reference(matches[0], name);
  };
  if (data.bars) {
    if (chartType !== 'stacked_bar' || data.groupBy !== undefined || !data.stacks) {
      throw new Error('Named bars require stacks and an ungrouped stacked bar chart.');
    }
    barSeriesIndices(data as BarVariables);
  }
  if (chartType === 'line') return data.variables.map((variable) => ({ line: reference(variable) }));
  if (chartType === 'stacked_bar') {
    if (data.stacks && !data.bars) {
      const segments = data.stacks.map(select);
      if (segments.length !== data.variables.length || new Set(segments.map(({ variable }) => variable)).size !== data.variables.length) {
        throw new Error('Each variable must match one stack.');
      }
      return segments.map((segment) => ({ segment }));
    }
    return data.variables.map((variable) => ({ segment: reference(variable) }));
  }
  let roles: Array<'line' | 'rangeLow' | 'rangeHigh' | 'x' | 'y' | 'size'>;
  if (chartType === 'line_with_range') roles = ['line', 'rangeLow', 'rangeHigh'];
  else if (chartType === 'scatter') roles = ['x', 'y'];
  else if (chartType === 'bubble') roles = ['x', 'y', 'size'];
  else throw new Error(`Unsupported chart type: ${chartType}`);
  const series = Object.fromEntries(roles.map((role) => [role, select(data[role])]));
  const used = new Set(Object.values(series).map(({ variable }) => variable));
  if (data.variables.some((variable) => !used.has(variable))) throw new Error('Each variable needs a chart role.');
  return [series];
}

export function barSeriesIndices({ variables, bars, stacks }: BarVariables) {
  const indices = bars.map(() => stacks.map(() => -1));
  for (const [index, variable] of variables.entries()) {
    const segments = variable.split('|');
    const matchingBars = bars.flatMap((bar, i) => segments.includes(bar) ? [i] : []);
    const matchingStacks = stacks.flatMap((stack, i) => segments.includes(stack) ? [i] : []);
    if (matchingBars.length !== 1 || matchingStacks.length !== 1) {
      throw new Error(`Variable "${variable}" must match one bar and one stack as whole subsegments.`);
    }
    const bar = matchingBars[0];
    const stack = matchingStacks[0];
    if (indices[bar][stack] !== -1) {
      throw new Error(`Bar "${bars[bar]}", stack "${stacks[stack]}" has more than one variable.`);
    }
    indices[bar][stack] = index;
  }
  if (indices.some((row) => row.includes(-1))) throw new Error('Each bar and stack pair needs a variable.');
  return indices;
}
