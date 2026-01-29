using System.Runtime.InteropServices;
using System;
using System.Windows.Forms;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Principal;
using Microsoft.Win32;

class Program
{
    const int ABM_NEW = 0x00000000;
    const int ABM_SETPOS = 0x00000003;
    const int ABM_REMOVE = 0x00000001;

    const int ABE_TOP = 1;

    [StructLayout(LayoutKind.Sequential)]
    struct APPBARDATA
    {
        public int cbSize;
        public IntPtr hWnd;
        public int uCallbackMessage;
        public int uEdge;
        public RECT rc;
        public int lParam;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct RECT
    {
        public int left, top, right, bottom;
    }

    [DllImport("user32.dll")]
    static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);
    static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);


    [DllImport("shell32.dll", CallingConvention = CallingConvention.StdCall)]
    static extern IntPtr SHAppBarMessage(int dwMessage, ref APPBARDATA pData);

    [DllImport("user32.dll")]
    static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll")]
    static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);

    const uint WM_LBUTTONDOWN = 0x0201;
    const uint WM_LBUTTONUP = 0x0202;
    const byte VK_LWIN = 0x5B;
    const byte VK_B = 0x42;
    const uint KEYEVENTF_KEYUP = 0x2;

    static int Main(string[] args)
    {
        if (args.Length > 0 && args[0].Equals("get-profile-image", StringComparison.OrdinalIgnoreCase))
        {
            var path = GetProfileImagePath();
            if (!string.IsNullOrWhiteSpace(path))
            {
                Console.WriteLine(path);
            }
            return 0;
        }

        SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        
        Application.Run(new AppBarForm());
        return 0;
    }

    static string GetProfileImagePath()
    {
        try
        {
            var sid = WindowsIdentity.GetCurrent()?.User?.Value;
            var valueNames = new[]
            {
                "Image1080",
                "Image448",
                "Image240",
                "Image192",
                "Image96",
                "Image48",
                "Image40",
                "Image32"
            };

            if (!string.IsNullOrWhiteSpace(sid))
            {
                var registryKeys = new RegistryKey[]
                {
                    Registry.CurrentUser.OpenSubKey($@"Software\Microsoft\Windows\CurrentVersion\AccountPicture\Users\{sid}"),
                    Registry.LocalMachine.OpenSubKey($@"SOFTWARE\Microsoft\Windows\CurrentVersion\AccountPicture\Users\{sid}"),
                    Registry.Users.OpenSubKey($@"{sid}\Software\Microsoft\Windows\CurrentVersion\AccountPicture\Users\{sid}")
                };

                foreach (var key in registryKeys)
                {
                    if (key == null) continue;
                    using (key)
                    {
                        foreach (var name in valueNames)
                        {
                            if (key.GetValue(name) is string candidate && File.Exists(candidate))
                            {
                                return candidate;
                            }
                        }
                    }
                }
            }

            var fallbackDirs = new[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Microsoft", "Windows", "AccountPictures"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Windows", "AccountPictures"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Microsoft", "User Account Pictures"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Microsoft", "Windows", "AccountPictures")
            };

            foreach (var dir in fallbackDirs)
            {
                if (!Directory.Exists(dir)) continue;

                var files = Directory.EnumerateFiles(dir, "*.*", SearchOption.TopDirectoryOnly)
                    .Where(file => file.EndsWith(".png", StringComparison.OrdinalIgnoreCase)
                        || file.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase)
                        || file.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase)
                        || file.EndsWith(".bmp", StringComparison.OrdinalIgnoreCase))
                    .Select(file => new FileInfo(file))
                    .OrderByDescending(info => info.LastWriteTimeUtc)
                    .ToList();

                if (!files.Any()) continue;

                if (!string.IsNullOrWhiteSpace(sid))
                {
                    var sidMatch = files.FirstOrDefault(info => info.Name.Contains(sid, StringComparison.OrdinalIgnoreCase));
                    if (sidMatch != null)
                    {
                        return sidMatch.FullName;
                    }
                }

                return files[0].FullName;
            }
        }
        catch
        {
            return null;
        }

        return null;
    }

    class AppBarForm : Form
    {
        public AppBarForm()
        {
            ShowInTaskbar = false;
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Minimized;
            Load += OnLoad;
            FormClosing += OnClose;
        }

        void OnLoad(object sender, EventArgs e)
        {
            var abd = new APPBARDATA();
            abd.cbSize = Marshal.SizeOf(abd);
            abd.hWnd = Handle;
            abd.uEdge = ABE_TOP;

            SHAppBarMessage(ABM_NEW, ref abd);

            int width = GetSystemMetrics(0); // SM_CXSCREEN

            abd.rc.left = 0;
            abd.rc.top = 0;
            abd.rc.right = width;
            abd.rc.bottom = 24;

            SHAppBarMessage(ABM_SETPOS, ref abd);
        }

        void OnClose(object sender, FormClosingEventArgs e)
        {
            var abd = new APPBARDATA();
            abd.cbSize = Marshal.SizeOf(abd);
            abd.hWnd = Handle;

            SHAppBarMessage(ABM_REMOVE, ref abd);
        }
    }
}
