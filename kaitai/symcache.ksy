meta:
  id: symcache
  file-extension: symcache
  endian: le
seq:
  - id: header
    type: header

  - id: files
    type: file
    repeat: expr
    repeat-expr: header.num_files

  - id: functions
    type: function
    repeat: expr
    repeat-expr: header.num_functions

  - id: source_locations
    type: source_location
    repeat: expr
    repeat-expr: header.num_source_locations

  - id: ranges
    type: range
    repeat: expr
    repeat-expr: header.num_ranges
  
# TODO: automatic padding?
  - id: padding_
    size: 4
  
  - id: string_bytes
    type: string_table
    size: header.string_bytes

types:
  header:
    seq:
      - id: magic
        contents: "SYMC"
      - id: version
        type: u4
      - id: debug_id
        size: 32
      - id: arch
        type: u4
      - id: num_files
        type: u4
      - id: num_functions
        type: u4
      - id: num_source_locations
        type: u4
      - id: num_ranges
        type: u4
      - id: string_bytes
        type: u4
      - id: reserved_
        size: 16

  file:
    seq:
      - id: comp_dir_offset
        type: u4
      - id: directory_offset
        type: u4
      - id: name_offset
        type: u4
    instances:
      comp_dir:
        io: _root.string_bytes._io
        type: string
        pos: comp_dir_offset
      directory:
        io: _root.string_bytes._io
        type: string
        pos: directory_offset
      name:
        io: _root.string_bytes._io
        type: string
        pos: name_offset

  function:
    seq:
      - id: name_offset
        type: u4
      - id: comp_dir_offset
        type: u4
      - id: entry_pc
        type: u4
      - id: lang
        type: u4

    instances:
      comp_dir:
        io: _root.string_bytes._io
        type: string
        pos: comp_dir_offset
      name:
        io: _root.string_bytes._io
        type: string
        pos: name_offset

  source_location:
    seq:
      - id: file_idx
        type: u4
      - id: line
        type: u4
      - id: function_idx
        type: u4
      - id: inlined_into_idx
        type: u4

    instances:
      file:
        #io: _root.files
        type: string
        #pos: _root.files[file_idx]
      #name:
      #  io: _root.string_bytes._io
      #  type: string
      #  pos: name_offset

  range:
    seq:
      - id: range
        type: u4

  string_table:
    seq:
      - id: strings
        type: string
        repeat: eos

  string:
#    params:
#      - id: offset
#        type: u4
    seq:
      - id: len
        type: u4
      - id: content
        type: str
        encoding: UTF-8
        size: len
#    instances:
#      value:
#        io: _root.string_bytes._io
#        pos: offset
#        size: len
