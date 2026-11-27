// 空战助手 —— 内置 WebView2 内核，不依赖外部浏览器
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Win32;

static class Program
{
    const string Name = "空战助手";
    const string Version = "1.5.4";

    static string DataDir;
    static string WebDir;
    static int Port = 0;
    static TcpListener Server;

    [STAThread]
    static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        DataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "空战助手");
        WebDir = Path.Combine(DataDir, "web");

        if (args.Length > 0 && args[0] == "--uninstall") { DoUninstall(); return; }

        if (IsOurs(8123))
        {
            Port = 8123;
        }
        else
        {
            try { EnsureAssets(); }
            catch (Exception ex)
            {
                MessageBox.Show("资源解包失败：" + ex.Message, Name, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            int p = 8123;
            while (p < 8135 && !TryServe(p)) p++;
            if (p >= 8135)
            {
                MessageBox.Show("本地端口都被占用了（8123-8134）。", Name, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
        }

        try
        {
            Application.Run(new PanelForm(Port));
        }
        catch (Exception ex)
        {
            MessageBox.Show("内置浏览器启动失败：" + ex.Message +
                "\n\n已改用系统浏览器打开。", Name, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            OpenExternal(Port);
        }
    }

    /* ---------------- 窗口 ---------------- */

    class PanelForm : Form
    {
        readonly int port;
        WebView2 web;
        bool full;

        public PanelForm(int port)
        {
            this.port = port;
            Text = Name + " 1.5.4 测试版";
            BackColor = Color.Black;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            Bounds = SecondaryBounds();
            KeyPreview = true;
            Icon = null;

            web = new WebView2();
            web.Dock = DockStyle.Fill;
            web.BackColor = Color.Black;
            Controls.Add(web);

            KeyDown += OnKey;
            Shown += async delegate { await Boot(); };
        }

        void OnKey(object s, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.F11)
            {
                full = !full;
                if (full)
                {
                    FormBorderStyle = FormBorderStyle.None;
                    Bounds = Screen.FromControl(this).Bounds;
                }
                else
                {
                    FormBorderStyle = FormBorderStyle.Sizable;
                    Bounds = SecondaryBounds();
                }
                e.Handled = true;
            }
            else if (e.KeyCode == Keys.F10)
            {
                Close();
            }
        }

        async Task Boot()
        {
            string udf = Path.Combine(DataDir, "wv2");
            Directory.CreateDirectory(udf);
            string cdp = Environment.GetEnvironmentVariable("KZ_CDP");
            CoreWebView2EnvironmentOptions opt = null;
            if (!string.IsNullOrEmpty(cdp))
                opt = new CoreWebView2EnvironmentOptions("--remote-debugging-port=" + cdp + " --disable-features=msWebOOUI");
            CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, udf, opt);
            await web.EnsureCoreWebView2Async(env);

            CoreWebView2Settings st = web.CoreWebView2.Settings;
            st.AreDefaultContextMenusEnabled = false;
            st.IsStatusBarEnabled = false;
            st.AreDevToolsEnabled = false;
            st.IsZoomControlEnabled = false;
            st.IsSwipeNavigationEnabled = false;
            st.AreHostObjectsAllowed = false;

            web.CoreWebView2.Settings.IsBuiltInErrorPageEnabled = true;
            web.CoreWebView2.Navigate("http://127.0.0.1:" + port + "/");
        }

        static Rectangle SecondaryBounds()
        {
            Screen[] all = Screen.AllScreens;
            for (int i = 0; i < all.Length; i++) if (!all[i].Primary) return all[i].Bounds;
            return all.Length > 0 ? all[0].Bounds : new Rectangle(0, 0, 1280, 720);
        }
    }

    static void OpenExternal(int port)
    {
        string url = "http://127.0.0.1:" + port + "/";
        string chrome = FindChrome();
        if (chrome == null) { Process.Start(url); return; }
        string profile = Path.Combine(DataDir, "browser");
        try { Directory.CreateDirectory(profile); } catch { }
        Rectangle b = Screen.PrimaryScreen.Bounds;
        string args = "--app=" + url + " --start-fullscreen --window-size=" + b.Width + "," + b.Height +
                      " --user-data-dir=\"" + profile + "\" --no-first-run --no-default-browser-check";
        try { Process.Start(new ProcessStartInfo(chrome, args)); }
        catch { Process.Start(url); }
    }

    static string FindChrome()
    {
        string[] c = new string[] {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe")
        };
        for (int i = 0; i < c.Length; i++) if (File.Exists(c[i])) return c[i];
        return null;
    }

    /* ---------------- 资源 ---------------- */
    static void EnsureAssets()
    {
        string marker = Path.Combine(WebDir, "version.txt");
        string index = Path.Combine(WebDir, "index.html");

        // 只有「标记正确 + 首页存在」才算完整，否则重新解包
        if (File.Exists(marker) && File.Exists(index) &&
            string.Equals(File.ReadAllText(marker).Trim(), Version, StringComparison.Ordinal))
            return;

        Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("WebAssets");
        if (s == null) throw new Exception("找不到内嵌资源");

        string tmpZip = Path.Combine(Path.GetTempPath(), "kz_" + Guid.NewGuid().ToString("N") + ".zip");
        using (FileStream fs = File.Create(tmpZip)) s.CopyTo(fs);

        // 先解到独立目录，校验完整后再换上去（避免和正在运行的旧实例抢文件）
        string stage = WebDir + ".new";
        if (Directory.Exists(stage)) Directory.Delete(stage, true);
        Directory.CreateDirectory(stage);
        ZipFile.ExtractToDirectory(tmpZip, stage);
        File.Delete(tmpZip);

        if (!File.Exists(Path.Combine(stage, "index.html")) ||
            !File.Exists(Path.Combine(stage, Path.Combine("css", "panel.css"))))
            throw new Exception("解包不完整：缺少 index.html 或 css");

        if (Directory.Exists(WebDir))
        {
            try { Directory.Delete(WebDir, true); }
            catch
            {
                // 旧目录被占用：改名挪开，稍后忽略
                string old = WebDir + ".old" + DateTime.Now.Ticks;
                try { Directory.Move(WebDir, old); } catch { }
            }
        }
        Directory.Move(stage, WebDir);
        File.WriteAllText(marker, Version);
    }

    /* ---------------- 迷你 HTTP 服务 ---------------- */
    static bool TryServe(int port)
    {
        try
        {
            TcpListener l = new TcpListener(IPAddress.Loopback, port);
            l.Start();
            Server = l;
            Port = port;
            Thread t = new Thread(AcceptLoop);
            t.IsBackground = true;
            t.Start();
            return true;
        }
        catch { return false; }
    }

    static void AcceptLoop()
    {
        while (true)
        {
            TcpClient c;
            try { c = Server.AcceptTcpClient(); }
            catch { break; }
            ThreadPool.QueueUserWorkItem(Handle, c);
        }
    }

    static void Handle(object state)
    {
        TcpClient client = (TcpClient)state;
        try
        {
            using (client)
            using (NetworkStream ns = client.GetStream())
            {
                StreamReader rd = new StreamReader(ns, Encoding.ASCII);
                string line = rd.ReadLine();
                if (string.IsNullOrEmpty(line)) return;

                string[] parts = line.Split(' ');
                string raw = parts.Length > 1 ? parts[1] : "/";
                while (!string.IsNullOrEmpty(line = rd.ReadLine())) { }

                int q = raw.IndexOf('?');
                if (q >= 0) raw = raw.Substring(0, q);
                if (raw == "/" || raw.Length == 0) raw = "/index.html";
                raw = Uri.UnescapeDataString(raw);
                string rel = raw.TrimStart('/').Replace('/', '\\');
                string full = Path.GetFullPath(Path.Combine(WebDir, rel));
                string root = Path.GetFullPath(WebDir);

                if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(full))
                {
                    byte[] nf = Encoding.ASCII.GetBytes("HTTP/1.1 404 Not Found\r\nContent-Length: 3\r\nConnection: close\r\n\r\n404");
                    ns.Write(nf, 0, nf.Length);
                    return;
                }

                byte[] body = File.ReadAllBytes(full);
                string head = "HTTP/1.1 200 OK\r\nContent-Type: " + Mime(full) +
                              "\r\nContent-Length: " + body.Length +
                              "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
                byte[] hb = Encoding.ASCII.GetBytes(head);
                ns.Write(hb, 0, hb.Length);
                ns.Write(body, 0, body.Length);
                ns.Flush();
            }
        }
        catch { }
    }

    static string Mime(string path)
    {
        switch (Path.GetExtension(path).ToLowerInvariant())
        {
            case ".html": return "text/html; charset=utf-8";
            case ".js": return "application/javascript; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".json": return "application/json; charset=utf-8";
            case ".png": return "image/png";
            case ".jpg": case ".jpeg": return "image/jpeg";
            case ".svg": return "image/svg+xml";
            case ".ttf": return "font/ttf";
            case ".woff2": return "font/woff2";
            case ".gltf": return "model/gltf+json";
            case ".bin": return "application/octet-stream";
            default: return "application/octet-stream";
        }
    }

    static bool IsOurs(int port)
    {
        try
        {
            using (TcpClient c = new TcpClient())
            {
                IAsyncResult ar = c.BeginConnect(IPAddress.Loopback, port, null, null);
                if (!ar.AsyncWaitHandle.WaitOne(400)) return false;
                c.EndConnect(ar);
                using (NetworkStream ns = c.GetStream())
                {
                    byte[] req = Encoding.ASCII.GetBytes("GET / HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n");
                    ns.Write(req, 0, req.Length);
                    ns.ReadTimeout = 900;
                    byte[] buf = new byte[8192];
                    int n = ns.Read(buf, 0, buf.Length);
                    string s = Encoding.UTF8.GetString(buf, 0, n);
                    return s.IndexOf("空战助手", StringComparison.Ordinal) >= 0;
                }
            }
        }
        catch { return false; }
    }

    /* ---------------- 卸载 ---------------- */
    static void DoUninstall()
    {
        if (MessageBox.Show("确定卸载「空战助手」？\n会删除快捷方式、数据和设置。", Name,
            MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;

        try
        {
            string desktop = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Name + ".lnk");
            if (File.Exists(desktop)) File.Delete(desktop);
            string start = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), Name + ".lnk");
            if (File.Exists(start)) File.Delete(start);
        }
        catch { }

        try { Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\空战助手", false); } catch { }
        try { if (Directory.Exists(DataDir)) Directory.Delete(DataDir, true); } catch { }

        try
        {
            string self = Path.GetDirectoryName(Application.ExecutablePath);
            Process.Start(new ProcessStartInfo("cmd.exe", "/c timeout /t 2 >nul & rmdir /s /q \"" + self + "\"")
            { WindowStyle = ProcessWindowStyle.Hidden, CreateNoWindow = true });
        }
        catch { }

        Application.Exit();
    }
}
