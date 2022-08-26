use core::ops::Range;

/// A Container calculating scroll positions
///
/// ```text
/// ┌ scroll position / offset
/// │  ┌╌╌╌╌╌╌╌╌╌┐
/// │  ╎         ╎ "virtual" content before rendered content
/// │  ╎         ╎
/// │  ├─────────┤
/// │  │         │ rendered content outside viewport (before)
/// ↓  │         │
/// ┏━━┿━━━━━━━━━┿━━┓ viewport
/// ┃  │         │  ┃
/// ┃  │         │  ┃  rendered content inside viewport
/// ┃  │         │  ┃
/// ┗━━┿━━━━━━━━━┿━━┛
///    │         │
///    │         │ rendered content outside viewport (after)
///    ├─────────┤
///    ╎         ╎
///    ╎         ╎ "virtual" content after rendered content
///    └╌╌╌╌╌╌╌╌╌┘
/// ```
#[derive(Debug)]
pub struct Container {
    num_items: u32,
    average_item_size: u32,

    viewport_size: u32,
    items_per_chunk: u32,
    rendered_items: u32,

    scroll_position: u32,
}

impl Container {
    pub fn new(num_items: u32, average_item_size: u32) -> Self {
        Self {
            num_items,
            average_item_size,

            viewport_size: average_item_size,
            items_per_chunk: 1,
            rendered_items: 1,

            scroll_position: 0,
        }
    }

    pub fn on_resize(&mut self, viewport_size: u32) {
        self.viewport_size = viewport_size;
        self.items_per_chunk = rounding_div(self.viewport_size, self.average_item_size);
        self.rendered_items = (self.items_per_chunk * 3).min(self.num_items);
    }

    pub fn on_scroll(&mut self, scroll_position: u32) -> LayoutUpdate {
        self.scroll_position = scroll_position;

        self.query()
    }

    pub fn query(&self) -> LayoutUpdate {
        let item_at_position = rounding_div(self.scroll_position, self.average_item_size);
        let chunk_at_position = rounding_div(item_at_position, self.items_per_chunk);
        let first_item = chunk_at_position.saturating_sub(1) * self.items_per_chunk;
        let last_item = first_item + self.rendered_items;

        let virtual_before = first_item * self.average_item_size;
        let virtual_after = (self.num_items - last_item) * self.average_item_size;

        LayoutUpdate {
            virtual_before,
            item_range: first_item..last_item,
            virtual_after,
        }
    }
}

#[derive(Debug)]
pub struct LayoutUpdate {
    pub virtual_before: u32,
    pub item_range: Range<u32>,
    pub virtual_after: u32,
}

fn rounding_div(a: u32, b: u32) -> u32 {
    (a + (b / 2)) / b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_start_edge() {
        let num_items = 1_000;
        let average_item_size = 10;
        let viewport_size = 50;

        let mut container = Container::new(num_items, average_item_size);

        container.on_resize(viewport_size);

        dbg!(container.on_scroll(0));
        dbg!(container.on_scroll(15));
        dbg!(container.on_scroll(60));

        dbg!(container.on_scroll(80));
        dbg!(container.on_scroll(120));
    }
}
