use super::sys;
use core::ffi::CStr;
use core::{mem, ptr};

use std::ffi::CString;

#[derive(Debug)]
pub struct Poke {
    pk_compiler: sys::pk_compiler,
}

impl Poke {
    pub fn new() -> Result<Self, ()> {
        std::env::set_var("POKEDATADIR", "poke/libpoke");
        std::env::set_var("POKE_LOAD_PATH", "poke/pickles");
        let pk_compiler = unsafe { sys::pk_compiler_new(&mut PK_TERM_NOP as *mut _) };
        if pk_compiler.is_null() {
            Err(())
        } else {
            Ok(Self { pk_compiler })
        }
    }

    pub fn load(&mut self, module: &str) -> Result<(), ()> {
        let cmod = CString::new(module).map_err(|_| ())?;
        // XXX: the return code seems to be reversed?
        let res = unsafe { sys::pk_load(self.pk_compiler, cmod.as_ptr()) };
        if res == sys::PK_OK as i32 {
            Ok(())
        } else {
            Err(())
        }
    }

    pub fn run(&mut self, buf: &str) -> Result<(), ()> {
        let cbuf = CString::new(buf).map_err(|_| ())?;
        let mut exc = sys::PK_NULL as sys::pk_val;
        let res = unsafe {
            sys::pk_compile_buffer(
                self.pk_compiler,
                cbuf.as_ptr(),
                ptr::null_mut(),
                &mut exc as *mut _,
            )
        };
        if res == sys::PK_OK as i32 {
            if exc == sys::PK_NULL as sys::pk_val {
                Ok(())
            } else {
                dbg!(exc);
                Err(())
            }
        } else {
            dbg!(res);
            Err(())
        }
    }

    pub fn pretty(&self) -> Result<(), ()> {
        let file_val = unsafe { sys::pk_decl_val(self.pk_compiler, "_file\n".as_ptr() as _) };
        if file_val == sys::PK_NULL as sys::pk_val {
            return Ok(());
        }

        let nfields_val = unsafe { sys::pk_struct_nfields(file_val) };
        let nfields = unsafe { sys::pk_uint_value(nfields_val) };

        for i in 0..=nfields {
            let field_name_val = unsafe { sys::pk_struct_field_name(file_val, i) };
            let field_name_cstr = unsafe { sys::pk_string_str(field_name_val) };
            let field_name = unsafe { CStr::from_ptr(field_name_cstr) };
            let field_name = field_name.to_str().map_err(|_| ())?;

            let field_offset_val = unsafe { sys::pk_struct_field_boffset(file_val, i) };
            let field_offset = unsafe { sys::pk_uint_value(field_offset_val) };

            let field_value_val = unsafe { sys::pk_struct_field_value(file_val, i) };
            let field_sizeof = unsafe { sys::pk_sizeof(field_value_val) };

            let field_end = field_offset + field_sizeof;
            println!("{field_offset:>4}-{field_end:<4} {field_name}");
        }

        // pk_struct_nfields
        // pk_struct_field_name
        // pk_struct_field_boffset
        // pk_struct_field_value
        // pk_sizeof
        //
        //
        // pk_val_offset // pk_val_boffset

        Ok(())
    }
}

impl Drop for Poke {
    fn drop(&mut self) {
        let pk_compiler = mem::replace(&mut self.pk_compiler, ptr::null_mut());
        if !pk_compiler.is_null() {
            unsafe {
                sys::pk_compiler_free(pk_compiler);
            }
        }
    }
}

static mut PK_TERM_NOP: sys::pk_term_if = sys::pk_term_if {
    flush_fn: Some(tif_flush),
    puts_fn: Some(tif_puts),
    printf_fn: Some(tif_printf),
    indent_fn: Some(tif_indent),
    class_fn: Some(tif_class),
    end_class_fn: Some(tif_end_class),
    hyperlink_fn: Some(tif_hyperlink),
    end_hyperlink_fn: Some(tif_end_hyperlink),
    get_color_fn: Some(tif_get_color),
    get_bgcolor_fn: Some(tif_get_bgcolor),
    set_color_fn: Some(tif_set_color),
    set_bgcolor_fn: Some(tif_set_bgcolor),
};

extern "C" fn tif_flush() {}
extern "C" fn tif_puts(_: *const i8) {}
unsafe extern "C" fn tif_printf(_: *const i8, _args: ...) {}
extern "C" fn tif_indent(_: u32, _: u32) {}
extern "C" fn tif_class(_: *const i8) {}
extern "C" fn tif_end_class(_: *const i8) -> i32 {
    1
}
extern "C" fn tif_hyperlink(_: *const i8, _: *const i8) {}
extern "C" fn tif_end_hyperlink() -> i32 {
    1
}
extern "C" fn tif_get_color() -> sys::pk_color {
    sys::pk_color {
        red: 255,
        green: 255,
        blue: 255,
    }
}
extern "C" fn tif_get_bgcolor() -> sys::pk_color {
    sys::pk_color {
        red: 0,
        green: 0,
        blue: 0,
    }
}
extern "C" fn tif_set_color(_: sys::pk_color) {}
extern "C" fn tif_set_bgcolor(_: sys::pk_color) {}
