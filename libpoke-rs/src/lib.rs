// well, bindgen should just not generate these things maybe?
#![feature(c_variadic)]

mod sys;
mod wrapper;

pub use wrapper::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic() {
        let mut poke = Poke::new().unwrap();

        dbg!(poke.load("elf"));

        dbg!(poke.run("var ios = open(\"crash\");"));

        let elf_file = "/Users/swatinem/Coding/symbolic/symbolic-testutils/fixtures/linux/crash";
        //poke.run(&format!("open(\"{elf_file}\")")).unwrap();

        dbg!(poke.run("var _file = Elf64_File @ 0#B"));

        poke.pretty();
    }
}
