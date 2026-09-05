<script lang="ts">
  import { KICK_MOD_DATA_URL } from '$lib/constants/kickModIcon'
  let { class: className = 'size-[calc(1em*(18/13))]' } = $props()
</script>

<img src={KICK_MOD_DATA_URL} alt="kick moderator" class={className} />
