using System.Runtime.InteropServices;
using System;
using System.Windows.Forms;
using System.Diagnostics;

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

    static void Main(string[] args)
    {
        SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        
        // Check if user wants to open system tray
        if (args.Length > 0 && args[0] == "--tray")
        {
            OpenSystemTray();
            return;
        }
        
        Application.Run(new AppBarForm());
    }

    static void OpenSystemTray()
    {
        // Send Windows key + B hotkey to open the system tray
        keybd_event(VK_LWIN, 0, 0, 0);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_B, 0, 0, 0);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_B, 0, KEYEVENTF_KEYUP, 0);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
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
