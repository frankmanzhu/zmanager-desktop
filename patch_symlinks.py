import os
import re
import glob

def process_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "tzapAllowDegraded" not in content and "tzap_allow_degraded" not in content:
        return
        
    lines = content.split('\n')
    new_lines = []
    
    for line in lines:
        new_lines.append(line)
        
        if "tzapAllowDegraded" in line or "tzap_allow_degraded" in line:
            # We don't want to duplicate if it's already there
            if "tzapAllowAbsoluteSymlinks" in line or "tzap_allow_absolute_symlinks" in line:
                continue
                
            new_line = line
            new_line = new_line.replace("tzapAllowDegraded", "tzapAllowAbsoluteSymlinks")
            new_line = new_line.replace("defaultTzapAllowDegraded", "defaultTzapAllowAbsoluteSymlinks")
            new_line = new_line.replace("tzap_allow_degraded", "tzap_allow_absolute_symlinks")
            new_line = new_line.replace("Allow degraded metadata restore", "Allow absolute symlinks")
            new_line = new_line.replace("允许降级还原元数据", "允许绝对符号链接")
            
            # Additional help text translation replacements if needed
            new_line = new_line.replace("Continue when requested native metadata cannot be restored, and report every skipped item as a job warning.", "Permit absolute symlinks to be extracted instead of aborting the extraction.")
            new_line = new_line.replace("请求的原生元数据无法还原时继续，并将每个跳过项目报告为任务警告。", "允许提取绝对符号链接，而不是中止提取。")
            
            if new_line != line and "tzapAllowAbsoluteSymlinks" not in content:
                new_lines.append(new_line)
                
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))

for root, _, files in os.walk("src"):
    for file in files:
        if file.endswith(".ts") or file.endswith(".tsx"):
            process_file(os.path.join(root, file))
