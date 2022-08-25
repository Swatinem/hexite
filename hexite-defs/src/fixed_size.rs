use crate::Context;

pub trait FixedSize {
    fn length(&self, ctx: Context) -> usize;
}

pub enum FixedSizeType {
    Struct(FixedSizeStruct),
    Primitive(Box<dyn FixedSizePrimitive>),
    Slice(FixedSizeSlice),
}

pub struct FixedSizeStruct {}

impl FixedSize for FixedSizeStruct {
    fn length(&self, ctx: Context) -> usize {
        todo!()
    }
}

pub trait FixedSizePrimitive: FixedSize {}

pub struct FixedSizeSlice {
    element_type: Box<FixedSizeType>,
}

impl FixedSize for FixedSizeSlice {
    fn length(&self, ctx: Context) -> usize {
        todo!()
    }
}
