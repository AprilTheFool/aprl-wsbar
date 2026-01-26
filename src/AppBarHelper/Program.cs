using System.Runtime.InteropServices;
using System;
using System.Windows.Forms;

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

    static void Main()
    {
        SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        Application.Run(new AppBarForm());
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
