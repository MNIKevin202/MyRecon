using System.Collections.Generic;

namespace Oxide.Plugins
{
    [Info("MyRconNoClip", "MyRcon", "1.0.0")]
    [Description("Lets permitted players toggle noclip (fly through walls) with /noclip.")]
    public class MyRconNoClip : RustPlugin
    {
        const string PermUse = "myrconnoclip.use";

        // Players the plugin temporarily flagged admin so the client accepts the
        // noclip command — tracked so we only revert what we changed.
        readonly HashSet<ulong> _elevated   = new HashSet<ulong>();
        readonly HashSet<ulong> _noclipping = new HashSet<ulong>();

        void Init()
        {
            permission.RegisterPermission(PermUse, this);
        }

        void Unload()
        {
            foreach (var id in _elevated)
            {
                var p = BasePlayer.FindByID(id);
                if (p != null) SetAdminFlag(p, false);
            }
            _elevated.Clear();
            _noclipping.Clear();
        }

        [ChatCommand("noclip")]
        void CmdNoClip(BasePlayer player, string command, string[] args)
        {
            if (player == null) return;
            if (!permission.UserHasPermission(player.UserIDString, PermUse))
            {
                SendReply(player, Prefix("You don't have permission to use noclip."));
                return;
            }
            Toggle(player);
        }

        [ConsoleCommand("myrcon.noclip")]
        void ConsoleNoClip(ConsoleSystem.Arg arg)
        {
            var player = arg.Player();
            if (player == null) return;
            if (!permission.UserHasPermission(player.UserIDString, PermUse)) return;
            Toggle(player);
        }

        void Toggle(BasePlayer player)
        {
            bool enabling = !_noclipping.Contains(player.userID);

            // The client only honours the noclip command when it thinks it's an
            // admin. Temporarily set the IsAdmin flag for non-admins, and remember
            // it so we can revert when they turn noclip off.
            if (enabling && !player.IsAdmin)
            {
                SetAdminFlag(player, true);
                _elevated.Add(player.userID);
            }

            player.SendConsoleCommand("noclip");

            if (enabling)
            {
                _noclipping.Add(player.userID);
                SendReply(player, Prefix("Noclip <color=#7CFC00>enabled</color> — type /noclip again to disable."));
            }
            else
            {
                _noclipping.Remove(player.userID);
                if (_elevated.Remove(player.userID))
                    SetAdminFlag(player, false);
                SendReply(player, Prefix("Noclip <color=#FF6347>disabled</color>."));
            }
        }

        void SetAdminFlag(BasePlayer player, bool isAdmin)
        {
            player.SetPlayerFlag(BasePlayer.PlayerFlags.IsAdmin, isAdmin);
            player.SendNetworkUpdateImmediate(false);
        }

        void OnPlayerDisconnected(BasePlayer player, string reason)
        {
            if (player == null) return;
            _noclipping.Remove(player.userID);
            if (_elevated.Remove(player.userID))
                SetAdminFlag(player, false);
        }

        static string Prefix(string msg) => string.Format("<color=#F06A0F>MyRcon NoClip</color>: {0}", msg);
    }
}
