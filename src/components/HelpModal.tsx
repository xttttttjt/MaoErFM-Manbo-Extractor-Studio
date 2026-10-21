import React from 'react';
import { X, Plane, KeyRound, Sparkles, HelpCircle, ExternalLink, ShieldCheck, CheckCircle2, Compass, Radio } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { CreditsBadge } from './CreditsBadge';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCookieModal?: () => void;
  initialPlatform?: 'missevan' | 'kilamanbo';
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  onOpenCookieModal,
  initialPlatform = 'missevan',
}) => {
  const { t, language } = useLanguage();
  const [platform, setPlatform] = React.useState<'missevan' | 'kilamanbo'>(initialPlatform);

  React.useEffect(() => {
    if (isOpen) {
      setPlatform(initialPlatform);
    }
  }, [isOpen, initialPlatform]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#060c18] border border-[#162744] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-left">
        {/* Header */}
        <div className="p-5 border-b border-[#14233c] flex items-center justify-between bg-[#091326]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-md font-bold ${
              platform === 'kilamanbo'
                ? 'bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-rose-950/60'
                : 'bg-gradient-to-tr from-sky-500 via-cyan-400 to-sky-500 text-slate-950 shadow-sky-950/60'
            }`}>
              <Compass className="w-5 h-5 animate-spin-turbine" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-white">
                {t('manualTitle')}
              </h3>
              <p className="text-xs text-slate-400">
                {platform === 'kilamanbo'
                  ? (language === 'vi' ? 'Hướng dẫn trích xuất âm thanh, phụ đề & ảnh bìa KilaManbo (漫播)' : 'Step-by-step extraction guide for KilaManbo (漫播)')
                  : t('manualSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer hover:bg-[#0c1628]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Tabs inside Help Modal */}
        <div className="px-5 pt-3 pb-2 bg-[#070e1c] border-b border-[#14233c] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlatform('missevan')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              platform === 'missevan'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-950/60'
                : 'bg-[#091222] border border-[#162744] text-slate-400 hover:text-white'
            }`}
          >
            MissEvan (猫耳FM)
          </button>
          <button
            type="button"
            onClick={() => setPlatform('kilamanbo')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              platform === 'kilamanbo'
                ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-md shadow-rose-950/60'
                : 'bg-[#091222] border border-[#162744] text-slate-400 hover:text-white'
            }`}
          >
            KilaManbo (漫播)
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs text-slate-300 leading-relaxed">
          {platform === 'missevan' ? (
            <>
              {/* MissEvan Step 1: Link & ID */}
              <div className="p-4 rounded-xl bg-[#091224] border border-[#182b4a] space-y-2.5">
                <div className="flex items-center gap-2 font-heading font-bold text-white text-base">
                  <span className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 text-xs flex items-center justify-center font-mono font-bold">1</span>
                  <span>{t('step1Title')}</span>
                </div>
                <p>{t('step1Desc')}</p>
                <div className="p-3 rounded-lg bg-[#040812] border border-[#13223a] font-mono text-[11px] text-sky-300 break-all select-all">
                  https://www.missevan.com/sound/player?id=13768262
                </div>
              </div>

              {/* MissEvan Step 2: How to get Cookies for VIP / Paid Episodes */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-[#0b162c] to-[#071020] border border-sky-600/50 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-heading font-bold text-white text-base">
                    <span className="w-5 h-5 rounded-full bg-sky-400 text-slate-950 font-extrabold text-xs flex items-center justify-center font-mono">2</span>
                    <span className="text-sky-200">{t('step2Title')}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-mono shrink-0">
                    VIP Clearance
                  </span>
                </div>

                <p className="text-slate-300">{t('step2Desc')}</p>

                <div className="space-y-3 pt-1">
                  <div className="p-3 rounded-xl bg-[#050c19] border border-sky-800/40 space-y-2">
                    <div className="font-semibold text-white flex items-center gap-1.5 text-[13px]">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>{t('step2Method1Title')}</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-300">
                      <li>{t('step2Method1Step1')}</li>
                      <li>{t('step2Method1Step2')}</li>
                      <li>{t('step2Method1Step3')}</li>
                      <li>{t('step2Method1Step4')}</li>
                      <li>{t('step2Method1Step5')}</li>
                      <li>{t('step2Method1Step6')}</li>
                    </ol>
                  </div>

                  <div className="p-3 rounded-xl bg-[#050c19] border border-[#14233c] space-y-1.5">
                    <div className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{t('step2Method2Title')}</span>
                    </div>
                    <p className="text-slate-400">{t('step2Method2Desc')}</p>
                  </div>
                </div>

                {onOpenCookieModal && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCookieModal();
                      }}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>{t('vipCookieButton')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* MissEvan Step 3: Official Subtitles vs Community Danmaku */}
              <div className="p-4 rounded-xl bg-[#091224] border border-[#182b4a] space-y-2">
                <div className="flex items-center gap-2 font-heading font-bold text-white text-base">
                  <span className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 text-xs flex items-center justify-center font-mono font-bold">3</span>
                  <span>{t('step3Title')}</span>
                </div>
                <p>{t('step3Desc')}</p>
              </div>

              {/* MissEvan Step 4: Export Formats */}
              <div className="p-4 rounded-xl bg-[#091224] border border-[#182b4a] space-y-2">
                <div className="flex items-center gap-2 font-heading font-bold text-white text-base">
                  <span className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 text-xs flex items-center justify-center font-mono font-bold">4</span>
                  <span>{t('step4Title')}</span>
                </div>
                <p>{t('step4Desc')}</p>
              </div>

              {/* MissEvan Step 5: Original Cover Art */}
              <div className="p-4 rounded-xl bg-[#091224] border border-[#182b4a] space-y-2">
                <div className="flex items-center gap-2 font-heading font-bold text-white text-base">
                  <span className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 text-xs flex items-center justify-center font-mono font-bold">5</span>
                  <span>{t('step5Title')}</span>
                </div>
                <p>{t('step5Desc')}</p>
              </div>
            </>
          ) : (
            <>
              {/* KilaManbo Step 1: Copy KilaManbo Link */}
              <div className="p-4 rounded-xl bg-[#0f1422] border border-[#241a2e] space-y-2.5">
                <div className="flex items-center gap-2 font-heading font-bold text-white text-base">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white text-xs flex items-center justify-center font-mono font-bold">1</span>
                  <span>{language === 'vi' ? 'Dán Liên Kết Hoặc ID Kịch KilaManbo (漫播)' : 'Copy KilaManbo URL or Drama ID'}</span>
                </div>
                <p>
                  {language === 'vi'
                    ? 'Bạn có thể copy trực tiếp liên kết trang chi tiết bộ kịch từ thanh địa chỉ trình duyệt trên trang kilamanbo.world. Hệ thống hỗ trợ đầy đủ các dạng liên kết có tham số bảo mật mã hóa `_specific_parameter` lẫn dạng ID số thuần túy.'
                    : 'Copy the drama link directly from your browser address bar on kilamanbo.world. Both encrypted `_specific_parameter` URLs and plaintext `dramaId` are automatically parsed and decrypted.'}
                </p>
                <div className="p-3 rounded-lg bg-[#070b14] border border-[#231d33] font-mono text-[11px] text-rose-300 break-all select-all">
                  https://www.kilamanbo.world/manbo/pc/detail?_specific_parameter=O_9HJLLv-XhnutNjSucR0...
                </div>
              </div>

              {/* KilaManbo Step 2: Automatic AES-128 Audio Decryption */}
              <div className="p-4 rounded-xl bg-[#0f1422] border border-[#241a2e] space-y-2.5">
                <div className="flex items-center gap-2 font-heading font-bold text-white text-base">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white text-xs flex items-center justify-center font-mono font-bold">2</span>
                  <span>{language === 'vi' ? 'Giải Mã Luồng Âm Thanh AES-128 Tự Động' : 'Automatic AES-128 Audio Decryption'}</span>
                </div>
                <p>
                  {language === 'vi'
                    ? 'File âm thanh trên KilaManbo được mã hóa AES-128-CBC. Máy chủ sẽ tự động giải mã các luồng âm thanh sang định dạng chuẩn, cho phép bạn nghe trực tiếp trên trình duyệt hoặc bấm nút "Tải File Âm Thanh" để lưu về máy tính (.m4a/.mp4).'
                    : 'Audio streams on KilaManbo are encrypted with AES-128-CBC. The server automatically decrypts streams on-the-fly, allowing instant browser playback and one-click downloading (.m4a/.mp4).'}
                </p>
              </div>

              {/* KilaManbo Step 3: Danmaku & Script Extraction */}
              <div className="p-4 rounded-xl bg-[#0f1422] border border-[#241a2e] space-y-2.5">
                <div className="flex items-center gap-2 font-heading font-bold text-white text-base">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white text-xs flex items-center justify-center font-mono font-bold">3</span>
                  <span>{language === 'vi' ? 'Trích Xuất Phụ Đề Đạn Mạc & Kịch Bản' : 'Danmaku & Script Timeline Extraction'}</span>
                </div>
                <p>
                  {language === 'vi'
                    ? 'Hệ thống tự động tải và đồng bộ dòng thời gian đạn mạc và phụ đề chính thức của từng tập kịch KilaManbo, hiển thị rõ ràng nhân vật, thời gian giây và nội dung thoại.'
                    : 'The app retrieves both listener danmaku comments and official script subtitles from KilaManbo, sorting lines chronologically with character names and exact timestamps.'}
                </p>
              </div>

              {/* KilaManbo Step 4: Subtitle Translation */}
              <div className="p-4 rounded-xl bg-[#0f1422] border border-[#241a2e] space-y-2.5">
                <div className="flex items-center gap-2 font-heading font-bold text-white text-base">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white text-xs flex items-center justify-center font-mono font-bold">4</span>
                  <span>{language === 'vi' ? 'Dịch Phụ Đề Sang Tiếng Việt, Tiếng Anh & Tây Ban Nha' : 'Bilingual & Target Subtitle Translation'}</span>
                </div>
                <p>
                  {language === 'vi'
                    ? 'Dùng Trung Tâm Dịch Phụ Đề để dịch toàn bộ tập hoặc từng câu đơn sang Tiếng Việt, Tiếng Anh hoặc Tây Ban Nha với văn phong kịch truyền thanh tự nhiên, chính xác nhân vật.'
                    : 'Use the Subtitle Translation Command Center to translate entire episodes or individual lines into Vietnamese, English, or Spanish with drama-accurate nuance.'}
                </p>
              </div>

              {/* KilaManbo Step 5: VIP Account Token */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-[#180e1a] to-[#0c0914] border border-rose-500/40 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-heading font-bold text-white text-base">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white text-xs flex items-center justify-center font-mono font-bold">5</span>
                    <span className="text-rose-200">{language === 'vi' ? 'Mở Khóa Tập VIP KilaManbo (authToken)' : 'KilaManbo VIP Clearance (authToken)'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-mono shrink-0">
                    VIP Token
                  </span>
                </div>
                <ol className="list-decimal list-outside ml-4 space-y-2 text-slate-300 pt-1 leading-relaxed">
                  {language === 'vi' ? (
                    <>
                      <li>Copy Console Script được cung cấp từ Tool (hoặc trong hộp thoại VIP Token).</li>
                      <li>Đăng nhập tài khoản Manbo và mở 1 tập kịch VIP bất kỳ của bộ kịch cần tải (lưu ý: tài khoản đã phải mua bộ kịch để tải được tập VIP về).</li>
                      <li>Bật cho tập kịch VIP chạy. Trong lúc đang chạy, bấm <kbd className="px-1 py-0.2 bg-[#050c18] rounded border border-slate-700 font-mono text-[10px]">F12</kbd> (hoặc Ctrl + Shift + I trên Windows, Option + Command + I trên macOS), sau đó reload lại trang web.</li>
                      <li>Ở thanh chọn tab của Dev Tool, chọn "Console". Sau đó, paste Console Script mà Tool đã cho vào tab và ấn Enter. Nếu tab báo "security warning", nhập thêm dòng <code className="text-amber-300">allow pasting</code>, rồi ấn Enter.</li>
                      <li>Sau khi làm thành công, 1 mã authToken mới sẽ được copy sẵn vào clipboard. Quay về Tool và paste mã đó vào ô nhập trên Tool.</li>
                    </>
                  ) : (
                    <>
                      <li>Copy the Console Script provided by the Tool (or inside the VIP Token dialog).</li>
                      <li>Log in to your Manbo account and open any VIP episode of the drama you want to download (Note: your account must have purchased the drama to download VIP episodes).</li>
                      <li>Start playing the VIP episode. While it is playing, press <kbd className="px-1 py-0.2 bg-[#050c18] rounded border border-slate-700 font-mono text-[10px]">F12</kbd> (or Ctrl + Shift + I on Windows, Option + Command + I on macOS), then reload the webpage.</li>
                      <li>In the DevTools tab bar, select "Console". Paste the Console Script provided by the Tool into the console and press Enter. If a "security warning" appears, type <code className="text-amber-300">allow pasting</code> first and press Enter, then paste and run the script again.</li>
                      <li>Once executed successfully, a new authToken credential will be automatically copied to your clipboard. Return to the Tool and paste it into the input box above.</li>
                    </>
                  )}
                </ol>
                {onOpenCookieModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCookieModal();
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{t('manboVipBtn')}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#14233c] bg-[#091326] flex flex-col sm:flex-row items-center justify-between gap-3">
          <CreditsBadge className="text-[11px]" showIcon={true} />
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            {t('backToDeck')}
          </button>
        </div>
      </div>
    </div>
  );
};
