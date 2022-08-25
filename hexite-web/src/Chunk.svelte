<script>
	const row16 = Array.from({length: 16}, (_, i) => i);
	const groups4 = Array.from({length: 4}, (_, i) => row16.slice(i*4, (i+1)*4));

	const undef = undefined;
	const ascii_escapes = [
		"\\0", undef, undef, undef, undef, undef, undef, undef, undef, "\\t", "\\n", "\\v", "\\f", "\\r",
	];
	
	export let offset = 0;
	export let buf;
	
	let start_offset = Math.floor(offset / 16) * 16;
	let start_padding = offset - start_offset;
	
	let rows = [];
	let num_rows = Math.ceil((start_padding + buf.length) / 16);
	for (let i = 0; i < num_rows; i++) {
		let row_offset = start_offset + i*16;
		
		rows.push(row_offset);
	}
	
	function has_data(row_offset, byte_offset) {
		return row_offset + byte_offset >= offset && (row_offset + byte_offset) - offset < buf.length;
	}
	function get_display(row_offset, byte_offset) {
		let byte = buf[(row_offset + byte_offset) - offset];
		if (byte < 0x7f) {
			if (byte > 0x1f) {
				return String.fromCharCode(byte).padStart(2, '.');
			} else {
				let escape = ascii_escapes[byte];
				if (escape != undefined) {
					return escape;
				}
			}
		}
		return byte.toString(16).toUpperCase().padStart(2, '0');
	}
</script>

<div class="chunk">
	
	{#each rows as row_offset}
	<div class="row">
		<span class="offset">
			{(row_offset.toString(16).slice(0,-1) + '_').padStart(8,'0')}
		</span>
		{#each groups4 as group}
		<span class="group">
			{#each group as byte}
			{#if has_data(row_offset, byte) }
				<span class="byte">{get_display(row_offset, byte)}</span>
			{:else}
				<span class="byte"></span>
			{/if}
			{/each}
		</span>
		{/each}
	</div>
	{/each}

</div>

<style>
	.chunk {
		display: flex;
		flex-direction: column;
	}
	.row {
		display: flex;
		flex-direction: row;
		column-gap: 10px;
	}
	.group {
		display: flex;
		column-gap: 5px;
	}
	.offset {
		width: 8ch;
		user-select: none;
	}
	.byte {
		width: 2ch;
		text-align: right;
	}
</style>