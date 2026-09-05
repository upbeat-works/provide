<script>
  import { formatRecordValue } from './model';

  export let model;

  $: columns = model.schema.columns.map((name) => model.fields.get(name));
</script>

<div class="overflow-x-auto">
  <table class="w-full border-collapse text-sm">
    <thead>
      <tr class="border-b border-contour-weakest text-left">
        {#each columns as field}
          <th scope="col" class="px-3 py-2 font-bold">{field.label}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each model.records as record}
        <tr class="border-b border-contour-weakest last:border-b-0">
          {#each columns as field}
            {#if model.schema.rowHeaders.includes(field.name)}
              <th scope="row" class="px-3 py-2 text-left font-bold">{formatRecordValue(record, field)}</th>
            {:else}
              <td class="px-3 py-2" class:text-right={typeof record[field.name] === 'number'}>{formatRecordValue(record, field)}</td>
            {/if}
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
