//! Generic definition of a format

use crate::{Context, FixedSizeType};

pub struct Format {
    ctx: Context,
    children: Vec<FormatChild>,
}

impl Format {
    pub fn new() -> Self {
        Self {
            ctx: Context {},
            children: vec![],
        }
    }

    pub fn add_child(&mut self, offset: usize, ty: FixedSizeType) {
        self.children.push(FormatChild { offset, ty });
    }
}

struct FormatChild {
    offset: usize,
    ty: FixedSizeType,
}
