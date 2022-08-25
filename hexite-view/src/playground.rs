use std::fmt::Display;

struct Format<'data> {
    data: &'data [u8],
}

trait Type {
    fn name(&self) -> &str;

    fn fixed_size(&self) -> Option<usize> {
        None
    }

    fn parse<'data>(&'data self, data: &'data [u8]) -> Box<dyn Value<'data> + 'data>;
}

trait Value<'data>: Display {
    fn size(&self) -> usize;

    fn ty(&self) -> &dyn Type;
}

struct Property<'data> {
    name: String,
    offset: usize,
    ty: Box<dyn Type>,
    value: Box<dyn Value<'data>>,
}

impl<'data> Property<'data> {
    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn start(&self) -> usize {
        self.offset
    }
    pub fn end(&self) -> usize {
        self.offset + self.value.size()
    }
}

struct U32;

impl Type for U32 {
    fn name(&self) -> &str {
        "u32"
    }

    fn fixed_size(&self) -> Option<usize> {
        Some(4)
    }

    fn parse<'data>(&'data self, data: &'data [u8]) -> Box<dyn Value<'data> + 'data> {
        let bytes = data[0..4].try_into().unwrap();
        let value = u32::from_ne_bytes(bytes) as u64;
        Box::new(ParsedNumber { ty: self, value })
    }
}

struct ParsedNumber<'data> {
    ty: &'data dyn Type,
    value: u64,
}

impl Display for ParsedNumber<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.value.fmt(f)
    }
}

impl<'data> Value<'data> for ParsedNumber<'data> {
    fn size(&self) -> usize {
        self.ty.fixed_size().unwrap()
    }

    fn ty(&self) -> &dyn Type {
        self.ty
    }
}

#[test]
fn test_parsing_stuff() {
    let data = &[1, 0, 0, 0];

    let ty = U32;
    let value = ty.parse(data);
    println!("{} (0..{}) = {}", value.ty().name(), value.size(), value);
}
