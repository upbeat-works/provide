<script>
  export let content;
</script>

{#if content}
  <div class="html-content text-theme-stronger">
    {@html content}
  </div>
{/if}
