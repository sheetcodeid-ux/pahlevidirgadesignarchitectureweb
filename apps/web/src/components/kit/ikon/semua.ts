/* BERKAS HASIL GENERATE — jangan disunting.
 * Sumbernya apps/web/src/assets/figma/ikon/*.svg (ekspor Figma pemilik).
 * Buat ulang dengan: python3 scripts/buat-ikon-ts.py
 */

/** Seluruh ikon, untuk halaman galeri saja. Sengaja di berkas sendiri:
 * menyebut daftar ini menarik semua ikon, dan itu hanya boleh terjadi
 * di chunk galeri. */
import type { DataIkon } from "./daftar";
import { ArchiveTray } from "./data/ArchiveTray";
import { ArrowClockwise } from "./data/ArrowClockwise";
import { ArrowDown } from "./data/ArrowDown";
import { ArrowLeft } from "./data/ArrowLeft";
import { ArrowRight } from "./data/ArrowRight";
import { ArrowUp } from "./data/ArrowUp";
import { ArrowsLeftRight } from "./data/ArrowsLeftRight";
import { Bell } from "./data/Bell";
import { BookmarkSimple } from "./data/BookmarkSimple";
import { Briefcase } from "./data/Briefcase";
import { CalendarBlank } from "./data/CalendarBlank";
import { CaretDown } from "./data/CaretDown";
import { CaretLeft } from "./data/CaretLeft";
import { CaretRight } from "./data/CaretRight";
import { CaretUp } from "./data/CaretUp";
import { ChalkboardTeacher } from "./data/ChalkboardTeacher";
import { ChartBar } from "./data/ChartBar";
import { ChatTeardropDots } from "./data/ChatTeardropDots";
import { Check } from "./data/Check";
import { CheckCircle } from "./data/CheckCircle";
import { CircleDashed } from "./data/CircleDashed";
import { CircleWavyCheck } from "./data/CircleWavyCheck";
import { Clock } from "./data/Clock";
import { CoinIn } from "./data/CoinIn";
import { CoinOut } from "./data/CoinOut";
import { CoinVertical } from "./data/CoinVertical";
import { ConversionRate } from "./data/ConversionRate";
import { CopySimple } from "./data/CopySimple";
import { CornersOut } from "./data/CornersOut";
import { CurrencyCircleDollar } from "./data/CurrencyCircleDollar";
import { CursorClick } from "./data/CursorClick";
import { DotsThree } from "./data/DotsThree";
import { DotsThreeVertical } from "./data/DotsThreeVertical";
import { DownloadSimple } from "./data/DownloadSimple";
import { EnvelopeOpen } from "./data/EnvelopeOpen";
import { Eye } from "./data/Eye";
import { FacebookLogo } from "./data/FacebookLogo";
import { FadersHorizontal } from "./data/FadersHorizontal";
import { FilePdf } from "./data/FilePdf";
import { FileText } from "./data/FileText";
import { FileX } from "./data/FileX";
import { FileXls } from "./data/FileXls";
import { Funnel } from "./data/Funnel";
import { GearSix } from "./data/GearSix";
import { Globe } from "./data/Globe";
import { GoogleDocsLogo } from "./data/GoogleDocsLogo";
import { GoogleDriveLogo } from "./data/GoogleDriveLogo";
import { GpsFix } from "./data/GpsFix";
import { GridFour } from "./data/GridFour";
import { Headset } from "./data/Headset";
import { Hourglass } from "./data/Hourglass";
import { HourglassHigh } from "./data/HourglassHigh";
import { House } from "./data/House";
import { IdentificationBadge } from "./data/IdentificationBadge";
import { ImageSquare } from "./data/ImageSquare";
import { Info } from "./data/Info";
import { InstagramLogo } from "./data/InstagramLogo";
import { Link } from "./data/Link";
import { LinkedinLogo } from "./data/LinkedinLogo";
import { List } from "./data/List";
import { MagnifyingGlass } from "./data/MagnifyingGlass";
import { MapPinArea } from "./data/MapPinArea";
import { Medal } from "./data/Medal";
import { Minus } from "./data/Minus";
import { NavArrowsLeftRight } from "./data/NavArrowsLeftRight";
import { NavCalendarDots } from "./data/NavCalendarDots";
import { NavCardholder } from "./data/NavCardholder";
import { NavCoins } from "./data/NavCoins";
import { NavCreditCard } from "./data/NavCreditCard";
import { NavCurrencyCircleDollar } from "./data/NavCurrencyCircleDollar";
import { NavCurrencyEth } from "./data/NavCurrencyEth";
import { NavEnvelope } from "./data/NavEnvelope";
import { NavNewspaper } from "./data/NavNewspaper";
import { NavPersonSimpleTaiChi } from "./data/NavPersonSimpleTaiChi";
import { NavReceipt } from "./data/NavReceipt";
import { NavSealPercent } from "./data/NavSealPercent";
import { NavSignOut } from "./data/NavSignOut";
import { NavSquaresFour } from "./data/NavSquaresFour";
import { Note } from "./data/Note";
import { NotePencil } from "./data/NotePencil";
import { PaperPlaneRight } from "./data/PaperPlaneRight";
import { Paperclip } from "./data/Paperclip";
import { Phone } from "./data/Phone";
import { Plus } from "./data/Plus";
import { PlusSquare } from "./data/PlusSquare";
import { Question } from "./data/Question";
import { Ruler } from "./data/Ruler";
import { SealPercent } from "./data/SealPercent";
import { ShareNetwork } from "./data/ShareNetwork";
import { ShoppingCart } from "./data/ShoppingCart";
import { SidebarSimple } from "./data/SidebarSimple";
import { SignIn } from "./data/SignIn";
import { Sliders } from "./data/Sliders";
import { SmileySticker } from "./data/SmileySticker";
import { Sort } from "./data/Sort";
import { SpecialAirplaneTilt } from "./data/SpecialAirplaneTilt";
import { SpecialAmazonLogo } from "./data/SpecialAmazonLogo";
import { SpecialAppleLogo } from "./data/SpecialAppleLogo";
import { SpecialArmchair } from "./data/SpecialArmchair";
import { SpecialBank } from "./data/SpecialBank";
import { SpecialBarbell } from "./data/SpecialBarbell";
import { SpecialBed } from "./data/SpecialBed";
import { SpecialBread } from "./data/SpecialBread";
import { SpecialCalendarCheck } from "./data/SpecialCalendarCheck";
import { SpecialCalendarSlash } from "./data/SpecialCalendarSlash";
import { SpecialCar } from "./data/SpecialCar";
import { SpecialCaretDoubleUp } from "./data/SpecialCaretDoubleUp";
import { SpecialCheckSquare } from "./data/SpecialCheckSquare";
import { SpecialCookingPot } from "./data/SpecialCookingPot";
import { SpecialCube } from "./data/SpecialCube";
import { SpecialCurrencyCircleDollar } from "./data/SpecialCurrencyCircleDollar";
import { SpecialDress } from "./data/SpecialDress";
import { SpecialDrop } from "./data/SpecialDrop";
import { SpecialDropHalfBottom } from "./data/SpecialDropHalfBottom";
import { SpecialFaceMask } from "./data/SpecialFaceMask";
import { SpecialFire } from "./data/SpecialFire";
import { SpecialFirstAid } from "./data/SpecialFirstAid";
import { SpecialFish } from "./data/SpecialFish";
import { SpecialFootprints } from "./data/SpecialFootprints";
import { SpecialForkKnife } from "./data/SpecialForkKnife";
import { SpecialGoogleLogo } from "./data/SpecialGoogleLogo";
import { SpecialGraduationCap } from "./data/SpecialGraduationCap";
import { SpecialHandbag } from "./data/SpecialHandbag";
import { SpecialHandshake } from "./data/SpecialHandshake";
import { SpecialHouseLine } from "./data/SpecialHouseLine";
import { SpecialInvoice } from "./data/SpecialInvoice";
import { SpecialKnife } from "./data/SpecialKnife";
import { SpecialLeaf } from "./data/SpecialLeaf";
import { SpecialLightning } from "./data/SpecialLightning";
import { SpecialListNumbers } from "./data/SpecialListNumbers";
import { SpecialMonitor } from "./data/SpecialMonitor";
import { SpecialMoonStars } from "./data/SpecialMoonStars";
import { SpecialPath } from "./data/SpecialPath";
import { SpecialPersonArmsSpread } from "./data/SpecialPersonArmsSpread";
import { SpecialPersonSimple } from "./data/SpecialPersonSimple";
import { SpecialPersonSimpleBike } from "./data/SpecialPersonSimpleBike";
import { SpecialPersonSimpleDeadlifts } from "./data/SpecialPersonSimpleDeadlifts";
import { SpecialPersonSimpleRun } from "./data/SpecialPersonSimpleRun";
import { SpecialPersonSimpleTaiChi } from "./data/SpecialPersonSimpleTaiChi";
import { SpecialPintGlass } from "./data/SpecialPintGlass";
import { SpecialReceiptX } from "./data/SpecialReceiptX";
import { SpecialRepeat } from "./data/SpecialRepeat";
import { SpecialRocketLaunch } from "./data/SpecialRocketLaunch";
import { SpecialSealCheck } from "./data/SpecialSealCheck";
import { SpecialShoppingCart } from "./data/SpecialShoppingCart";
import { SpecialSneaker } from "./data/SpecialSneaker";
import { SpecialSpeedometer } from "./data/SpecialSpeedometer";
import { SpecialSpotifyLogo } from "./data/SpecialSpotifyLogo";
import { SpecialSuitcase } from "./data/SpecialSuitcase";
import { SpecialTShirt } from "./data/SpecialTShirt";
import { SpecialTicket } from "./data/SpecialTicket";
import { SpecialUmbrella } from "./data/SpecialUmbrella";
import { SpecialUserCirclePlus } from "./data/SpecialUserCirclePlus";
import { SpecialWarehouse } from "./data/SpecialWarehouse";
import { SpecialWarning } from "./data/SpecialWarning";
import { SpecialWatch } from "./data/SpecialWatch";
import { SpecialWindowsLogo } from "./data/SpecialWindowsLogo";
import { SpecialWrench } from "./data/SpecialWrench";
import { SpecialXLogo } from "./data/SpecialXLogo";
import { SpinnerGap } from "./data/SpinnerGap";
import { ThumbsUp } from "./data/ThumbsUp";
import { Timer } from "./data/Timer";
import { Trash } from "./data/Trash";
import { TrendDown } from "./data/TrendDown";
import { TrendUp } from "./data/TrendUp";
import { TwitterLogo } from "./data/TwitterLogo";
import { UserCircle } from "./data/UserCircle";
import { UserCircleCheck } from "./data/UserCircleCheck";
import { UserSwitch } from "./data/UserSwitch";
import { Users } from "./data/Users";
import { VideoCamera } from "./data/VideoCamera";
import { VirtualAccount } from "./data/VirtualAccount";
import { Wallet } from "./data/Wallet";
import { WarningOctagon } from "./data/WarningOctagon";
import { WechatLogo } from "./data/WechatLogo";
import { X } from "./data/X";
import { XLogo } from "./data/XLogo";
import { YoutubeLogo } from "./data/YoutubeLogo";
import { ZoomLogo } from "./data/ZoomLogo";

export const SEMUA_IKON: ReadonlyArray<readonly [string, DataIkon]> = [
  ["ArchiveTray", ArchiveTray],
  ["ArrowClockwise", ArrowClockwise],
  ["ArrowDown", ArrowDown],
  ["ArrowLeft", ArrowLeft],
  ["ArrowRight", ArrowRight],
  ["ArrowUp", ArrowUp],
  ["ArrowsLeftRight", ArrowsLeftRight],
  ["Bell", Bell],
  ["BookmarkSimple", BookmarkSimple],
  ["Briefcase", Briefcase],
  ["CalendarBlank", CalendarBlank],
  ["CaretDown", CaretDown],
  ["CaretLeft", CaretLeft],
  ["CaretRight", CaretRight],
  ["CaretUp", CaretUp],
  ["ChalkboardTeacher", ChalkboardTeacher],
  ["ChartBar", ChartBar],
  ["ChatTeardropDots", ChatTeardropDots],
  ["Check", Check],
  ["CheckCircle", CheckCircle],
  ["CircleDashed", CircleDashed],
  ["CircleWavyCheck", CircleWavyCheck],
  ["Clock", Clock],
  ["CoinIn", CoinIn],
  ["CoinOut", CoinOut],
  ["CoinVertical", CoinVertical],
  ["ConversionRate", ConversionRate],
  ["CopySimple", CopySimple],
  ["CornersOut", CornersOut],
  ["CurrencyCircleDollar", CurrencyCircleDollar],
  ["CursorClick", CursorClick],
  ["DotsThree", DotsThree],
  ["DotsThreeVertical", DotsThreeVertical],
  ["DownloadSimple", DownloadSimple],
  ["EnvelopeOpen", EnvelopeOpen],
  ["Eye", Eye],
  ["FacebookLogo", FacebookLogo],
  ["FadersHorizontal", FadersHorizontal],
  ["FilePdf", FilePdf],
  ["FileText", FileText],
  ["FileX", FileX],
  ["FileXls", FileXls],
  ["Funnel", Funnel],
  ["GearSix", GearSix],
  ["Globe", Globe],
  ["GoogleDocsLogo", GoogleDocsLogo],
  ["GoogleDriveLogo", GoogleDriveLogo],
  ["GpsFix", GpsFix],
  ["GridFour", GridFour],
  ["Headset", Headset],
  ["Hourglass", Hourglass],
  ["HourglassHigh", HourglassHigh],
  ["House", House],
  ["IdentificationBadge", IdentificationBadge],
  ["ImageSquare", ImageSquare],
  ["Info", Info],
  ["InstagramLogo", InstagramLogo],
  ["Link", Link],
  ["LinkedinLogo", LinkedinLogo],
  ["List", List],
  ["MagnifyingGlass", MagnifyingGlass],
  ["MapPinArea", MapPinArea],
  ["Medal", Medal],
  ["Minus", Minus],
  ["Nav-ArrowsLeftRight", NavArrowsLeftRight],
  ["Nav-CalendarDots", NavCalendarDots],
  ["Nav-Cardholder", NavCardholder],
  ["Nav-Coins", NavCoins],
  ["Nav-CreditCard", NavCreditCard],
  ["Nav-CurrencyCircleDollar", NavCurrencyCircleDollar],
  ["Nav-CurrencyEth", NavCurrencyEth],
  ["Nav-Envelope", NavEnvelope],
  ["Nav-Newspaper", NavNewspaper],
  ["Nav-PersonSimpleTaiChi", NavPersonSimpleTaiChi],
  ["Nav-Receipt", NavReceipt],
  ["Nav-SealPercent", NavSealPercent],
  ["Nav-SignOut", NavSignOut],
  ["Nav-SquaresFour", NavSquaresFour],
  ["Note", Note],
  ["NotePencil", NotePencil],
  ["PaperPlaneRight", PaperPlaneRight],
  ["Paperclip", Paperclip],
  ["Phone", Phone],
  ["Plus", Plus],
  ["PlusSquare", PlusSquare],
  ["Question", Question],
  ["Ruler", Ruler],
  ["SealPercent", SealPercent],
  ["ShareNetwork", ShareNetwork],
  ["ShoppingCart", ShoppingCart],
  ["SidebarSimple", SidebarSimple],
  ["SignIn", SignIn],
  ["Sliders", Sliders],
  ["SmileySticker", SmileySticker],
  ["Sort", Sort],
  ["Special-AirplaneTilt", SpecialAirplaneTilt],
  ["Special-AmazonLogo", SpecialAmazonLogo],
  ["Special-AppleLogo", SpecialAppleLogo],
  ["Special-Armchair", SpecialArmchair],
  ["Special-Bank", SpecialBank],
  ["Special-Barbell", SpecialBarbell],
  ["Special-Bed", SpecialBed],
  ["Special-Bread", SpecialBread],
  ["Special-CalendarCheck", SpecialCalendarCheck],
  ["Special-CalendarSlash", SpecialCalendarSlash],
  ["Special-Car", SpecialCar],
  ["Special-CaretDoubleUp", SpecialCaretDoubleUp],
  ["Special-CheckSquare", SpecialCheckSquare],
  ["Special-CookingPot", SpecialCookingPot],
  ["Special-Cube", SpecialCube],
  ["Special-CurrencyCircleDollar", SpecialCurrencyCircleDollar],
  ["Special-Dress", SpecialDress],
  ["Special-Drop", SpecialDrop],
  ["Special-DropHalfBottom", SpecialDropHalfBottom],
  ["Special-FaceMask", SpecialFaceMask],
  ["Special-Fire", SpecialFire],
  ["Special-FirstAid", SpecialFirstAid],
  ["Special-Fish", SpecialFish],
  ["Special-Footprints", SpecialFootprints],
  ["Special-ForkKnife", SpecialForkKnife],
  ["Special-GoogleLogo", SpecialGoogleLogo],
  ["Special-GraduationCap", SpecialGraduationCap],
  ["Special-Handbag", SpecialHandbag],
  ["Special-Handshake", SpecialHandshake],
  ["Special-HouseLine", SpecialHouseLine],
  ["Special-Invoice", SpecialInvoice],
  ["Special-Knife", SpecialKnife],
  ["Special-Leaf", SpecialLeaf],
  ["Special-Lightning", SpecialLightning],
  ["Special-ListNumbers", SpecialListNumbers],
  ["Special-Monitor", SpecialMonitor],
  ["Special-MoonStars", SpecialMoonStars],
  ["Special-Path", SpecialPath],
  ["Special-PersonArmsSpread", SpecialPersonArmsSpread],
  ["Special-PersonSimple", SpecialPersonSimple],
  ["Special-PersonSimpleBike", SpecialPersonSimpleBike],
  ["Special-PersonSimpleDeadlifts", SpecialPersonSimpleDeadlifts],
  ["Special-PersonSimpleRun", SpecialPersonSimpleRun],
  ["Special-PersonSimpleTaiChi", SpecialPersonSimpleTaiChi],
  ["Special-PintGlass", SpecialPintGlass],
  ["Special-ReceiptX", SpecialReceiptX],
  ["Special-Repeat", SpecialRepeat],
  ["Special-RocketLaunch", SpecialRocketLaunch],
  ["Special-SealCheck", SpecialSealCheck],
  ["Special-ShoppingCart", SpecialShoppingCart],
  ["Special-Sneaker", SpecialSneaker],
  ["Special-Speedometer", SpecialSpeedometer],
  ["Special-SpotifyLogo", SpecialSpotifyLogo],
  ["Special-Suitcase", SpecialSuitcase],
  ["Special-TShirt", SpecialTShirt],
  ["Special-Ticket", SpecialTicket],
  ["Special-Umbrella", SpecialUmbrella],
  ["Special-UserCirclePlus", SpecialUserCirclePlus],
  ["Special-Warehouse", SpecialWarehouse],
  ["Special-Warning", SpecialWarning],
  ["Special-Watch", SpecialWatch],
  ["Special-WindowsLogo", SpecialWindowsLogo],
  ["Special-Wrench", SpecialWrench],
  ["Special-XLogo", SpecialXLogo],
  ["SpinnerGap", SpinnerGap],
  ["ThumbsUp", ThumbsUp],
  ["Timer", Timer],
  ["Trash", Trash],
  ["TrendDown", TrendDown],
  ["TrendUp", TrendUp],
  ["TwitterLogo", TwitterLogo],
  ["UserCircle", UserCircle],
  ["UserCircleCheck", UserCircleCheck],
  ["UserSwitch", UserSwitch],
  ["Users", Users],
  ["VideoCamera", VideoCamera],
  ["VirtualAccount", VirtualAccount],
  ["Wallet", Wallet],
  ["WarningOctagon", WarningOctagon],
  ["WechatLogo", WechatLogo],
  ["X", X],
  ["XLogo", XLogo],
  ["YoutubeLogo", YoutubeLogo],
  ["ZoomLogo", ZoomLogo],
];
