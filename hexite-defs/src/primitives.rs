use crate::{FixedSize, FixedSizePrimitive};

pub struct U32 {}

impl FixedSize for U32 {
    fn length(&self, _ctx: crate::Context) -> usize {
        4
    }
}

impl FixedSizePrimitive for U32 {}
