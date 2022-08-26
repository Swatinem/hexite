use std::env;
use std::path::PathBuf;

fn main() {
    /*cc::Build::new()
    .files(&["poke/libpoke/libpoke.c"])
    .include("poke/libpoke")
    .compile("poke");*/

    /*let dst = autotools::Config::new("poke")
    .disable("threads", None)
    .disable("libnbd", None)
    .disable("hserver", None)
    .without("otherdep", None)
    .fast_build(true)
    .build();*/

    // well using `autotools` did not really work, but manually invoking
    // configure + make did yield a `libpoke.a` which I hope we can just use?
    println!("cargo:rustc-link-search=native=poke/libpoke/.libs/");
    println!("cargo:rustc-link-lib=static=poke");

    // dependencies:
    println!("cargo:rustc-link-lib=dylib=intl");
    println!("cargo:rustc-link-lib=dylib=gc");

    println!("cargo:rerun-if-changed=poke/libpoke/libpoke.h");

    let bindings = bindgen::Builder::default()
        .header("poke/libpoke/libpoke.h")
        .parse_callbacks(Box::new(bindgen::CargoCallbacks))
        .use_core()
        .generate()
        .expect("Unable to generate bindings");

    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_path.join("bindings.rs"))
        .expect("Couldn't write bindings!");
}
