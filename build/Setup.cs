// 空战助手 安装程序 v3.1 —— 覆盖安装 / 环境检查 / 静默安装
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

static class Setup
{
    // 注意：不要用 Name 作常量名，会被 Windows.Forms.Control.Name 遮蔽
    const string AppName = "空战助手";
    const string Version = "1.4.0";
    const string RegPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\空战助手";

    [STAThread]
    static void Main()
    {
        string[] args = Environment.GetCommandLineArgs();
        if (args.Length >= 3 && args[1] == "--silent")
        {
            int code = SilentInstall(args[2]);
            Environment.Exit(code);
        }
        if (args.Length >= 2 && args[1] == "--silent-uninstall")
        {
            Environment.Exit(SilentUninstall());
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new SetupForm());
    }

    /* ---------------- 环境 ---------------- */
    static string DotNetRelease()
    {
        try
        {
            using (RegistryKey k = Registry.LocalMachine.OpenSubKey(
                @"SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full"))
            {
                if (k == null) return null;
                object r = k.GetValue("Release");
                return r == null ? null : r.ToString();
            }
        }
        catch { return null; }
    }

    static string WebView2Version()
    {
        string[] paths = new string[] {
            @"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
            @"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
        };
        for (int i = 0; i < paths.Length; i++)
        {
            try
            {
                using (RegistryKey k = Registry.LocalMachine.OpenSubKey(paths[i]))
                {
                    if (k != null) { object pv = k.GetValue("pv"); if (pv != null) return pv.ToString(); }
                }
            }
            catch { }
            try
            {
                using (RegistryKey k = Registry.CurrentUser.OpenSubKey(paths[i]))
                {
                    if (k != null) { object pv = k.GetValue("pv"); if (pv != null) return pv.ToString(); }
                }
            }
            catch { }
        }
        return null;
    }

    static string InstalledDir()
    {
        try
        {
            using (RegistryKey k = Registry.CurrentUser.OpenSubKey(RegPath))
            {
                if (k == null) return null;
                object loc = k.GetValue("InstallLocation");
                return loc == null ? null : loc.ToString();
            }
        }
        catch { return null; }
    }

    static string InstalledVersion()
    {
        try
        {
            using (RegistryKey k = Registry.CurrentUser.OpenSubKey(RegPath))
            {
                if (k == null) return null;
                object v = k.GetValue("DisplayVersion");
                return v == null ? null : v.ToString();
            }
        }
        catch { return null; }
    }

    static void KillRunning()
    {
        try
        {
            foreach (Process p in Process.GetProcesses())
            {
                try { if (p.ProcessName == AppName) p.Kill(); } catch { }
            }
            System.Threading.Thread.Sleep(400);
        }
        catch { }
    }

    static void Extract(string zip, string dir)
    {
        Directory.CreateDirectory(dir);
        using (ZipArchive a = ZipFile.OpenRead(zip))
        {
            foreach (ZipArchiveEntry e in a.Entries)
            {
                string dest = Path.Combine(dir, e.FullName.Replace('/', Path.DirectorySeparatorChar));
                string sub = Path.GetDirectoryName(dest);
                if (!string.IsNullOrEmpty(sub)) Directory.CreateDirectory(sub);
                e.ExtractToFile(dest, true);
            }
        }
    }

    /* ---------------- 安装核心 ---------------- */
    static string InstallCore(string dir)
    {
        KillRunning();

        string root = Path.GetPathRoot(Path.GetFullPath(dir));
        DriveInfo di = new DriveInfo(root);
        if (di.AvailableFreeSpace < 32L * 1024 * 1024)
            throw new Exception("磁盘剩余空间不足 32 MB。");

        Directory.CreateDirectory(dir);
        string probe = Path.Combine(dir, ".kz_write_test");
        File.WriteAllText(probe, "ok");
        File.Delete(probe);

        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("Payload"))
        {
            if (s == null) throw new Exception("安装包损坏：找不到程序文件");
            string pz = Path.Combine(Path.GetTempPath(), "kz_payload.zip");
            using (FileStream fs = File.Create(pz)) s.CopyTo(fs);
            Extract(pz, dir);
            File.Delete(pz);
        }

        string target = Path.Combine(dir, AppName + ".exe");
        if (!File.Exists(target)) throw new Exception("安装后找不到主程序：" + target);

        CreateShortcut(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk"),
            target, "", AppName);

        string startMenu = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
        CreateShortcut(Path.Combine(startMenu, AppName + ".lnk"), target, "", AppName);
        CreateShortcut(Path.Combine(startMenu, "卸载 " + AppName + ".lnk"), target, "--uninstall", AppName);

        using (RegistryKey k = Registry.CurrentUser.CreateSubKey(RegPath))
        {
            k.SetValue("DisplayName", AppName);
            k.SetValue("DisplayVersion", Version);
            k.SetValue("Publisher", AppName);
            k.SetValue("InstallLocation", dir);
            k.SetValue("DisplayIcon", target + ",0");
            k.SetValue("UninstallString", "\"" + target + "\" --uninstall");
            k.SetValue("QuietUninstallString", "\"" + target + "\" --uninstall");
            k.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"));
            k.SetValue("NoModify", 1, RegistryValueKind.DWord);
            k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            try
            {
                long size = 0;
                foreach (FileInfo f in new DirectoryInfo(dir).GetFiles("*", SearchOption.AllDirectories))
                    size += f.Length;
                k.SetValue("EstimatedSize", (int)(size / 1024), RegistryValueKind.DWord);
            }
            catch { }
        }

        return target;
    }

    static int SilentInstall(string dir)
    {
        try
        {
            string t = InstallCore(dir);
            File.WriteAllText(Path.Combine(Path.GetTempPath(), "kz_setup.log"), "OK " + t);
            return 0;
        }
        catch (Exception ex)
        {
            File.WriteAllText(Path.Combine(Path.GetTempPath(), "kz_setup.log"), "ERR " + ex.Message);
            return 1;
        }
    }

    static int SilentUninstall()
    {
        try
        {
            KillRunning();
            string dir = InstalledDir();
            if (!string.IsNullOrEmpty(dir) && Directory.Exists(dir)) Directory.Delete(dir, true);
            string desk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk");
            if (File.Exists(desk)) File.Delete(desk);
            string sm = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            if (File.Exists(Path.Combine(sm, AppName + ".lnk"))) File.Delete(Path.Combine(sm, AppName + ".lnk"));
            if (File.Exists(Path.Combine(sm, "卸载 " + AppName + ".lnk"))) File.Delete(Path.Combine(sm, "卸载 " + AppName + ".lnk"));
            Registry.CurrentUser.DeleteSubKeyTree(RegPath, false);
            return 0;
        }
        catch { return 1; }
    }

    static void CreateShortcut(string lnk, string target, string args, string desc)
    {
        Type t = Type.GetTypeFromProgID("WScript.Shell");
        object shell = Activator.CreateInstance(t);
        object sc = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnk });
        Type st = sc.GetType();
        st.InvokeMember("TargetPath", BindingFlags.SetProperty, null, sc, new object[] { target });
        st.InvokeMember("Arguments", BindingFlags.SetProperty, null, sc, new object[] { args == null ? "" : args });
        st.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, sc,
            new object[] { Path.GetDirectoryName(target) });
        st.InvokeMember("Description", BindingFlags.SetProperty, null, sc, new object[] { desc == null ? "" : desc });
        st.InvokeMember("IconLocation", BindingFlags.SetProperty, null, sc, new object[] { target + ",0" });
        st.InvokeMember("Save", BindingFlags.InvokeMethod, null, sc, null);
    }

    /* ---------------- 界面 ---------------- */
    class SetupForm : Form
    {
        TextBox txtDir;
        CheckBox chkDesktop, chkLaunch;
        Button btnInstall, btnCancel, btnUninstall, btnBrowse, btnRuntime;
        Label lblStatus, lblExisting, lblEnv;
        string oldDir;

        public SetupForm()
        {
            Text = AppName + " 安装程序 " + Version + " 测试版";
            ClientSize = new Size(560, 350);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(20, 22, 25);
            ForeColor = Color.FromArgb(232, 235, 238);
            Font = new Font("Microsoft YaHei UI", 9f);

            Label title = new Label();
            title.Text = AppName;
            title.Font = new Font("Microsoft YaHei UI", 21f, FontStyle.Bold);
            title.ForeColor = Color.FromArgb(79, 208, 122);
            title.SetBounds(22, 14, 300, 40);
            Controls.Add(title);

            Label sub = new Label();
            sub.Text = "战争雷霆副屏 MFD 仪表盘 · 测试版 v" + Version;
            sub.ForeColor = Color.FromArgb(150, 158, 164);
            sub.SetBounds(24, 56, 460, 22);
            Controls.Add(sub);

            lblExisting = new Label();
            lblExisting.SetBounds(24, 84, 512, 44);
            lblExisting.ForeColor = Color.FromArgb(216, 169, 92);
            Controls.Add(lblExisting);

            lblEnv = new Label();
            lblEnv.SetBounds(24, 130, 512, 40);
            lblEnv.ForeColor = Color.FromArgb(150, 158, 164);
            Controls.Add(lblEnv);

            Label l1 = new Label();
            l1.Text = "安装到：";
            l1.SetBounds(24, 176, 70, 22);
            Controls.Add(l1);

            txtDir = new TextBox();
            txtDir.SetBounds(96, 172, 340, 26);
            Controls.Add(txtDir);

            btnBrowse = new Button();
            btnBrowse.Text = "浏览…";
            btnBrowse.SetBounds(444, 171, 92, 28);
            btnBrowse.FlatStyle = FlatStyle.Flat;
            btnBrowse.Click += delegate
            {
                FolderBrowserDialog d = new FolderBrowserDialog();
                if (d.ShowDialog() == DialogResult.OK) txtDir.Text = Path.Combine(d.SelectedPath, AppName);
            };
            Controls.Add(btnBrowse);

            chkDesktop = new CheckBox();
            chkDesktop.Text = "创建桌面快捷方式";
            chkDesktop.Checked = true;
            chkDesktop.SetBounds(96, 208, 260, 24);
            Controls.Add(chkDesktop);

            chkLaunch = new CheckBox();
            chkLaunch.Text = "安装完成后立即启动";
            chkLaunch.Checked = true;
            chkLaunch.SetBounds(96, 234, 260, 24);
            Controls.Add(chkLaunch);

            lblStatus = new Label();
            lblStatus.SetBounds(24, 262, 512, 22);
            lblStatus.ForeColor = Color.FromArgb(150, 158, 164);
            Controls.Add(lblStatus);

            btnInstall = new Button();
            btnInstall.Text = "安 装";
            btnInstall.SetBounds(300, 292, 110, 36);
            btnInstall.BackColor = Color.FromArgb(31, 90, 51);
            btnInstall.ForeColor = Color.FromArgb(234, 255, 239);
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.FlatAppearance.BorderColor = Color.FromArgb(44, 107, 60);
            btnInstall.Click += delegate { DoInstall(); };
            Controls.Add(btnInstall);

            btnRuntime = new Button();
            btnRuntime.Text = "装运行时";
            btnRuntime.SetBounds(430, 126, 100, 26);
            btnRuntime.FlatStyle = FlatStyle.Flat;
            btnRuntime.Visible = false;
            btnRuntime.Click += delegate { InstallRuntime(); };
            Controls.Add(btnRuntime);

            btnUninstall = new Button();
            btnUninstall.Text = "卸载旧版";
            btnUninstall.SetBounds(190, 292, 100, 36);
            btnUninstall.FlatStyle = FlatStyle.Flat;
            btnUninstall.Visible = false;
            btnUninstall.Click += delegate { DoUninstallOld(); };
            Controls.Add(btnUninstall);

            btnCancel = new Button();
            btnCancel.Text = "取 消";
            btnCancel.SetBounds(420, 292, 90, 36);
            btnCancel.FlatStyle = FlatStyle.Flat;
            btnCancel.Click += delegate { Close(); };
            Controls.Add(btnCancel);

            AcceptButton = btnInstall;
            CancelButton = btnCancel;

            Load += delegate { Preflight(); };
        }

        void Preflight()
        {
            string def = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs", AppName);

            oldDir = InstalledDir();
            string oldVer = InstalledVersion();

            if (!string.IsNullOrEmpty(oldDir) && Directory.Exists(oldDir))
            {
                lblExisting.Text = "检测到已安装：" + (string.IsNullOrEmpty(oldVer) ? "旧版本" : "v" + oldVer) +
                                   "\n位置：" + oldDir + "　→ 将直接覆盖安装";
                lblExisting.ForeColor = Color.FromArgb(216, 169, 92);
                txtDir.Text = oldDir;
                btnInstall.Text = "覆盖安装";
                btnUninstall.Visible = true;
            }
            else
            {
                lblExisting.Text = "未检测到已安装版本，将全新安装。";
                lblExisting.ForeColor = Color.FromArgb(93, 217, 155);
                txtDir.Text = def;
            }

            RefreshEnv();
        }

        void RefreshEnv()
        {
            string wv = WebView2Version();
            string dn = DotNetRelease();
            string env = "";
            bool ok = true;

            if (wv == null)
            {
                env += "⚠ WebView2 运行时缺失 → 内置浏览器不可用（可点右侧按钮自动安装）";
                ok = false;
                btnRuntime.Visible = true;
            }
            else
            {
                env += "✓ WebView2 " + wv;
                btnRuntime.Visible = false;
            }

            if (dn == null)
            {
                env += "\n⚠ 未检测到 .NET Framework 4.x —— 程序无法启动，需先装 .NET 4.8";
                ok = false;
            }
            else
            {
                try
                {
                    int rel = int.Parse(dn);
                    env += "　·　.NET 4." + (rel >= 533320 ? "8+" : (rel >= 528040 ? "8" : "x(" + rel + ")"));
                }
                catch { env += "　·　.NET 4.x"; }
            }

            lblEnv.Text = env;
            lblEnv.ForeColor = ok ? Color.FromArgb(93, 217, 155) : Color.FromArgb(216, 169, 92);
        }

        async void InstallRuntime()
        {
            try
            {
                btnRuntime.Enabled = false;
                lblStatus.Text = "正在下载 WebView2 运行时…";
                Application.DoEvents();

                string url = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
                string tmp = Path.Combine(Path.GetTempPath(), "MicrosoftEdgeWebview2Setup.exe");
                if (File.Exists(tmp)) File.Delete(tmp);

                using (System.Net.WebClient wc = new System.Net.WebClient())
                {
                    wc.DownloadProgressChanged += delegate (object o, System.Net.DownloadProgressChangedEventArgs e)
                    {
                        lblStatus.Text = "正在下载 WebView2 运行时… " + e.ProgressPercentage + "%";
                    };
                    await wc.DownloadFileTaskAsync(new Uri(url), tmp);
                }

                lblStatus.Text = "正在安装（可能弹出 UAC 提示）…";
                Application.DoEvents();

                ProcessStartInfo psi = new ProcessStartInfo(tmp, "/silent /install");
                psi.UseShellExecute = true;
                psi.Verb = "runas";
                Process p2 = Process.Start(psi);
                p2.WaitForExit();

                RefreshEnv();
                lblStatus.Text = WebView2Version() != null ? "WebView2 安装成功。" : "安装未完成，可稍后重试或手动安装。";
            }
            catch (Exception ex)
            {
                lblStatus.Text = "自动安装失败：" + ex.Message;
            }
            finally
            {
                btnRuntime.Enabled = true;
            }
        }

        void DoInstall()
        {
            string dir = txtDir.Text.Trim();
            if (dir.Length == 0) { MessageBox.Show("请选择安装目录。"); return; }

            try
            {
                btnInstall.Enabled = false;

                lblStatus.Text = "正在关闭已运行的程序…";
                Application.DoEvents();

                if (WebView2Version() == null)
                {
                    var r = MessageBox.Show(
                        "当前系统没有 WebView2 运行时，安装后会用系统浏览器（Chrome/Edge）打开面板。\n\n仍要继续安装吗？",
                        AppName, MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
                    if (r != DialogResult.Yes) { btnInstall.Enabled = true; return; }
                }

                lblStatus.Text = "正在安装文件…";
                Application.DoEvents();

                string target = InstallCore(dir);

                lblStatus.Text = "安装完成。";
                if (chkLaunch.Checked)
                {
                    try { Process.Start(target); } catch { }
                }

                MessageBox.Show("安装完成！\n\n位置：" + target +
                                "\n版本：v" + Version +
                                "\n\n桌面 / 开始菜单已创建快捷方式，可在「设置 → 应用」卸载。",
                                AppName, MessageBoxButtons.OK, MessageBoxIcon.Information);
                Close();
            }
            catch (Exception ex)
            {
                btnInstall.Enabled = true;
                lblStatus.Text = "安装失败。";
                MessageBox.Show("安装失败：" + ex.Message, AppName, MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        void DoUninstallOld()
        {
            if (MessageBox.Show("卸载已安装的「" + AppName + "」？\n会删除程序目录、快捷方式和卸载项。",
                AppName, MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;

            try
            {
                lblStatus.Text = "正在卸载旧版…";
                Application.DoEvents();
                SilentUninstall();
                lblStatus.Text = "旧版已卸载，可以重新安装。";
                lblExisting.Text = "未检测到已安装版本，将全新安装。";
                lblExisting.ForeColor = Color.FromArgb(93, 217, 155);
                btnUninstall.Visible = false;
                btnInstall.Text = "安 装";
                txtDir.Text = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", AppName);
                btnInstall.Enabled = true;
            }
            catch (Exception ex)
            {
                MessageBox.Show("卸载失败：" + ex.Message, AppName, MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
