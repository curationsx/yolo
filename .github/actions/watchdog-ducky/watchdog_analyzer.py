#!/usr/bin/env python3
import os
import sys
import subprocess
import re
import json

def get_rules():
    rules_file = os.environ.get("RULES_FILE", ".watchdog-rules.json")
    if os.path.exists(rules_file):
        with open(rules_file, "r") as f:
            return json.load(f)
    # Fallback to defaults
    return {
        r'\bthreads\b': "Threads/conversation layer is deferred to >= v0.3."
    }

def get_recent_diff():
    base_ref = os.environ.get("GITHUB_BASE_REF")
    if base_ref:
        subprocess.run(["git", "fetch", "origin", base_ref, "--depth=1"], check=False)
        cmd = ["git", "diff", f"origin/{base_ref}"]
    else:
        cmd = ["git", "diff", "HEAD~1"]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout

def analyze_diff(diff_text, rules):
    findings = []
    current_file = "Unknown"
    
    lines = diff_text.split('\n')
    for line in lines:
        if line.startswith('+++ b/'):
            current_file = line[6:]
            continue
            
        if line.startswith('+') and not line.startswith('+++'):
            for pattern, warning in rules.items():
                if re.search(pattern, line, re.IGNORECASE):
                    # Output GitHub Actions native annotation
                    print(f"::error file={current_file},title=🦆 Scope Creep Detected::Found '{pattern}' - {warning}")
                    findings.append(f"🦆 **QUACK**: Found `{pattern}` in `{current_file}`. {warning}\n   _Line:_ `{line.strip()}`")
                    break 
    return findings

def main():
    rules = get_rules()
    diff_text = get_recent_diff()
    
    if not diff_text:
        print("No diff found. Scope is secure.")
        sys.exit(0)
        
    findings = analyze_diff(diff_text, rules)
    
    if findings:
        report = "### 🚫 Scope Bounds Traversed\n" + "\n".join(findings) + "\n\n_Update your roadmap or revert the lines._"
        if os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_EVENT_NAME") == "pull_request":
            with open("watchdog_report.md", "w") as f:
                f.write(report)
            pr_url = os.environ.get("GITHUB_EVENT_PULL_REQUEST_HTML_URL")
            if pr_url:
                subprocess.run(
                    ["gh", "pr", "comment", pr_url, "-F", "watchdog_report.md"],
                    check=False,
                )
        sys.exit(1)
    else:
        print("### ✅ Scope Secure")
        sys.exit(0)

if __name__ == "__main__":
    main()
