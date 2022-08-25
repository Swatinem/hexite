//! A view applying a format definition to a buffer

use std::ops::Range;

use hexite_defs::Format;

mod playground;

pub struct View<'data> {
    data: &'data [u8],
    format: Format,
}

impl<'data> View<'data> {
    pub fn new(data: &'data [u8], format: Format) -> Self {
        Self { data, format }
    }

    pub fn query(&mut self, range: Range<usize>) {}
}

pub struct Hierarchy<'data> {
    path: Vec<(&'data str, usize)>,
}

#[cfg(test)]
mod tests {
    use hexite_defs::{FixedSizeType, U32};

    use super::*;

    #[test]
    fn test_primitive() {
        let data = &[1, 0, 0, 0];

        let mut format = Format::new();
        format.add_child(0, FixedSizeType::Primitive(Box::new(U32 {})));
        let mut view = View::new(data, format);

        dbg!(view.query(0..0x1000));
    }
}
