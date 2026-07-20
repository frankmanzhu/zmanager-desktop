use std::path::Path;

fn main() {
    println!("{:?}", Path::new(".").file_name());
    println!("{:?}", Path::new("/").file_name());
    println!("{:?}", Path::new("/home/frank/beeware-tutorial/").file_name());
    println!("{:?}", Path::new("beeware-tutorial").file_name());
}
