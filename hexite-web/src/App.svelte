<script>
	import Chunk from './Chunk.svelte';
	
	const row16 = Array.from({length: 16}, (_, i) => i);
	const groups4 = Array.from({length: 4}, (_, i) => row16.slice(i*4, (i+1)*4));
	
	let encoder = new TextEncoder();
	let text = "hello world\nor whatever meh!\0\n\rlets give a bit more\tto display here! ;-)";
	text += text;
	text += text;
	text += text;
	let buf = encoder.encode(text);
	
	let chunks = [4,8,24,24,24,24,180,180];
	let offset = 0;
	chunks = chunks.map((chunk_offset) => {
		let start_offset = offset;
		offset += chunk_offset;
		return { offset: start_offset, buf: buf.slice(start_offset, offset) };
	});
	chunks.push({ offset, buf: buf.slice(offset) });
	
	chunks = chunks.filter(chunk => chunk.buf.length);
	
	function on_copy(event) {
		// TODO:
		let data = event.clipboardData;
		//data.setData("type", data);
		//event.preventDefault();
	}
</script>

<div class="hex" on:cut={on_copy} on:copy={on_copy}>
	<div class="row header">
		<span class="offset"></span>
		{#each groups4 as group}
		<span class="group">
			{#each group as byte}
			<span class="byte">_{byte.toString(16).toUpperCase()}</span>
			{/each}
		</span>
		{/each}
	</div>

	{#each chunks as chunk}
		<Chunk buf={chunk.buf} offset={chunk.offset} />
	{/each}

</div>

<style>
	.hex {
		font-family: monospace;
		white-space: pre;
		display: flex;
		flex-direction: column;
		row-gap: 5px;
	}
	.header {
		user-select: none;
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
	}
	.byte {
		width: 2ch;
	}
</style>