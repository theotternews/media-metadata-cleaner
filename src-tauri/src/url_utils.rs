/// Convert a git remote URL to an HTTPS base URL for homepage/issues links.
pub fn git_remote_to_https(url: &str) -> String {
    let url = url.trim();
    if url.starts_with("https://") || url.starts_with("http://") {
        return url
            .trim_end_matches('/')
            .trim_end_matches(".git")
            .to_string();
    }
    if url.starts_with("ssh://") {
        return url
            .replacen("ssh://", "https://", 1)
            .trim_end_matches('/')
            .trim_end_matches(".git")
            .to_string();
    }
    if let Some(after) = url.strip_prefix("git@") {
        let (host, path) = after
            .split_once(':')
            .or_else(|| after.split_once('/'))
            .unwrap_or((after, ""));
        let path = path.trim_end_matches(".git").trim_start_matches('/');
        if path.is_empty() {
            format!("https://{}", host)
        } else {
            format!("https://{}/{}", host, path)
        }
    } else {
        url.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn https_url() {
        assert_eq!(
            git_remote_to_https("https://github.com/user/repo.git"),
            "https://github.com/user/repo"
        );
    }

    #[test]
    fn https_url_without_git_suffix() {
        assert_eq!(
            git_remote_to_https("https://github.com/user/repo"),
            "https://github.com/user/repo"
        );
    }

    #[test]
    fn https_url_with_trailing_slash() {
        assert_eq!(
            git_remote_to_https("https://github.com/user/repo/"),
            "https://github.com/user/repo"
        );
    }

    #[test]
    fn http_url() {
        assert_eq!(
            git_remote_to_https("http://github.com/user/repo.git"),
            "http://github.com/user/repo"
        );
    }

    #[test]
    fn ssh_colon_style() {
        assert_eq!(
            git_remote_to_https("git@github.com:user/repo.git"),
            "https://github.com/user/repo"
        );
    }

    #[test]
    fn ssh_colon_style_no_suffix() {
        assert_eq!(
            git_remote_to_https("git@github.com:user/repo"),
            "https://github.com/user/repo"
        );
    }

    #[test]
    fn ssh_protocol_prefix() {
        assert_eq!(
            git_remote_to_https("ssh://git@github.com/user/repo.git"),
            "https://git@github.com/user/repo"
        );
    }

    #[test]
    fn ssh_slash_style() {
        assert_eq!(
            git_remote_to_https("git@gitlab.com/org/project.git"),
            "https://gitlab.com/org/project"
        );
    }

    #[test]
    fn trims_whitespace_and_newlines() {
        assert_eq!(
            git_remote_to_https("  https://github.com/user/repo.git\n"),
            "https://github.com/user/repo"
        );
    }

    #[test]
    fn unknown_format_returned_as_is() {
        assert_eq!(
            git_remote_to_https("some-unknown-string"),
            "some-unknown-string"
        );
    }
}
