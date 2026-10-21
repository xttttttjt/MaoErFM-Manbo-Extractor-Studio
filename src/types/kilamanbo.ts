export interface KilaManboEpisodeAudioResp {
  normalQualityResp?: {
    audioUrl?: string;
    decryptedAudioUrl?: string;
    length?: string;
    name?: string;
    type?: number;
    memberNeed?: boolean;
    duration?: number;
  };
  highQualityResp?: {
    audioUrl?: string;
    decryptedAudioUrl?: string;
    length?: string;
    name?: string;
    type?: number;
    memberNeed?: boolean;
    duration?: number;
  };
  superQualityResp?: {
    audioUrl?: string;
    decryptedAudioUrl?: string;
    length?: string;
    name?: string;
    type?: number;
    memberNeed?: boolean;
    duration?: number;
  };
}

export interface KilaManboEpisode {
  setId: number;
  setIdStr: string;
  radioDramaId: number;
  bizType: number;
  setNo: number;
  setTitle: string;
  setName?: string;
  desc?: string;
  setPic: string;
  duration: number; // in milliseconds
  setLrcUrl?: string;
  status: number;
  payType: number; // 0 = free, 1 = paid
  price?: number;
  memberPrice?: number;
  type: number; // 0/1/3
  vipFree?: number;
  setAudioResp?: KilaManboEpisodeAudioResp;
  subTitle?: string;
  isBuy?: number;
}

export interface KilaManboCV {
  cvId?: string | number;
  cvName: string;
  roleName?: string;
  avatarUrl?: string;
}

export interface KilaManboDramaDetail {
  radioDramaId: number;
  radioDramaIdStr: string;
  title: string;
  desc: string;
  coverPic: string;
  largePic?: string;
  sharePicUrl?: string;
  status: number;
  endStatus: number; // 0 = updating, 1 = finished
  price?: number;
  memberPrice?: number;
  payType?: number;
  copyrightInfo?: string;
  onlineSetCount?: number;
  watchCount?: number;
  likeCount?: number;
  favoriteCount?: number;
  commentCount?: number;
  ownerResp?: {
    id: number;
    nickname: string;
    headPortraitUrl?: string;
    introduction?: string;
  };
  lastSetTitle?: string;
  isBuy?: number;
  vipFree?: number;
  setRespList: KilaManboEpisode[];
  cvRespList?: KilaManboCV[];
}

export interface KilaManboDanmakuItem {
  danmakuId: string;
  radioDramaSetId: string;
  relativeTime: number; // in seconds or milliseconds
  content: string;
  createTime?: number;
  status?: number;
  danmakuSource?: number; // 1 = official/special, 2 = user
}
