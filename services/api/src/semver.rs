/// Compare semver strings (major.minor.patch). Returns -1, 0, or 1.
pub fn compare(a: &str, b: &str) -> i32 {
    let pa: Vec<u32> = a.split('.').map(|s| s.parse().unwrap_or(0)).collect();
    let pb: Vec<u32> = b.split('.').map(|s| s.parse().unwrap_or(0)).collect();
    for i in 0..3 {
        let da = pa.get(i).copied().unwrap_or(0);
        let db = pb.get(i).copied().unwrap_or(0);
        if da < db {
            return -1;
        }
        if da > db {
            return 1;
        }
    }
    0
}

#[cfg(test)]
mod tests {
    use super::compare;

    #[test]
    fn compare_versions() {
        assert!(compare("0.1.0", "0.2.0") < 0);
        assert!(compare("1.0.0", "0.9.9") > 0);
        assert_eq!(compare("0.1.0", "0.1.0"), 0);
    }
}
