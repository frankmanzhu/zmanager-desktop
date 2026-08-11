param(
  [Parameter(Mandatory = $true)]
  [string] $ProcessName
)

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class ZManagerWindowProbe {
    [StructLayout(LayoutKind.Sequential)]
    public struct Point {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MinMaxInfo {
        public Point Reserved;
        public Point MaxSize;
        public Point MaxPosition;
        public Point MinTrackSize;
        public Point MaxTrackSize;
    }

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);
}
"@

$windowProcess = Get-Process -Name $ProcessName |
  Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
  Select-Object -First 1
if ($null -eq $windowProcess) {
  throw "Could not find a visible $ProcessName window."
}

$message = 0x0024
$size = [Runtime.InteropServices.Marshal]::SizeOf([type] [ZManagerWindowProbe+MinMaxInfo])
$buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal($size)
try {
  [Runtime.InteropServices.Marshal]::StructureToPtr(
    [ZManagerWindowProbe+MinMaxInfo]::new(),
    $buffer,
    $false
  )
  [ZManagerWindowProbe]::SendMessage($windowProcess.MainWindowHandle, $message, [IntPtr]::Zero, $buffer) | Out-Null
  $info = [Runtime.InteropServices.Marshal]::PtrToStructure(
    $buffer,
    [type] [ZManagerWindowProbe+MinMaxInfo]
  )

  [pscustomobject] @{
    minTrackWidth = $info.MinTrackSize.X
    minTrackHeight = $info.MinTrackSize.Y
  } | ConvertTo-Json -Compress
}
finally {
  [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)
}
