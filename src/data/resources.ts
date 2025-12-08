import { Character, ArtifactSet, ElementResource, WeaponResource, ArtifactHalfSet } from './types';

// Characters data
export const characters: Character[] = [
  {
    "id": "jahoda",
    "element": "Anemo",
    "rarity": 4,
    "weapon": "Bow",
    "region": "Nod-Krai",
    "releaseDate": "2025-12-03",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/12/01/19708bac6eba4779a70908bf0bee70b1_1653339605275422455.png",
    "imagePath": "/character/jahoda.png"
  },
  {
    "id": "durin",
    "element": "Pyro",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Mondstadt",
    "releaseDate": "2025-12-03",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/11/28/e3e2b8fcbff2f2f3cdcec6bbf04efa84_3327367670955368711.png",
    "imagePath": "/character/durin.png"
  },
  {
    "id": "nefer",
    "element": "Dendro",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Nod-Krai",
    "releaseDate": "2025-10-22",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/10/21/7557acebcb72b4d9912bcb0e6c92306a_3655566527985254987.png",
    "imagePath": "/character/nefer.png"
  },
  {
    "id": "flins",
    "element": "Electro",
    "rarity": 5,
    "weapon": "Polearm",
    "region": "Nod-Krai",
    "releaseDate": "2025-09-30",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2025/09/29/35428890/f6feccecc61d2bf772461f057dfb41cd_5944664216414192017.png",
    "imagePath": "/character/flins.png"
  },
  {
    "id": "aino",
    "element": "Hydro",
    "rarity": 4,
    "weapon": "Claymore",
    "region": "Nod-Krai",
    "releaseDate": "2025-09-10",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/09/09/4e58c851d6c947865026faa168db83bd_3944254802105067377.png",
    "imagePath": "/character/aino.png"
  },
  {
    "id": "lauma",
    "element": "Dendro",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Nod-Krai",
    "releaseDate": "2025-09-10",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/09/08/b06e9ff48d57de4856f1a05b1199aae1_8565150401481594895.png",
    "imagePath": "/character/lauma.png"
  },
  {
    "id": "ineffa",
    "element": "Electro",
    "rarity": 5,
    "weapon": "Polearm",
    "region": "Nod-Krai",
    "releaseDate": "2025-07-30",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/07/28/7c221918444852e9a3c2ad609ccacea2_8687518447126752117.png",
    "imagePath": "/character/ineffa.png"
  },
  {
    "id": "dahlia",
    "element": "Hydro",
    "rarity": 4,
    "weapon": "Sword",
    "region": "Mondstadt",
    "releaseDate": "2025-06-18",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/06/16/255dedc5048565aec2c5af510c6f74a5_7726536808309970424.png",
    "imagePath": "/character/dahlia.png"
  },
  {
    "id": "skirk",
    "element": "Cryo",
    "rarity": 5,
    "weapon": "Sword",
    "region": "None",
    "releaseDate": "2025-06-18",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/06/16/48dba0c10560a3ef573f17d97408b5a0_2527001828446746987.png",
    "imagePath": "/character/skirk.png"
  },
  {
    "id": "ifa",
    "element": "Anemo",
    "rarity": 4,
    "weapon": "Catalyst",
    "region": "Natlan",
    "releaseDate": "2025-05-07",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/04/30/ce693d1e36aef5936b2d2db006605fc4_9036718103340803450.png",
    "imagePath": "/character/ifa.png"
  },
  {
    "id": "escoffier",
    "element": "Cryo",
    "rarity": 5,
    "weapon": "Polearm",
    "region": "Fontaine",
    "releaseDate": "2025-05-07",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/04/30/ddbc128157d69479f61747f0918f9e72_2470321636402108639.png",
    "imagePath": "/character/escoffier.png"
  },
  {
    "id": "iansan",
    "element": "Electro",
    "rarity": 4,
    "weapon": "Polearm",
    "region": "Natlan",
    "releaseDate": "2025-03-26",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/03/25/dd9a200a86b792fb1b73ef1ee7de0911_2097378734184941134.png",
    "imagePath": "/character/iansan.png"
  },
  {
    "id": "varesa",
    "element": "Electro",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Natlan",
    "releaseDate": "2025-03-26",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/03/25/a54efe1bb7e82a589b9af44683a696ca_8635138146175164187.png",
    "imagePath": "/character/varesa.png"
  },
  {
    "id": "yumemizuki_mizuki",
    "element": "Anemo",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Inazuma",
    "releaseDate": "2025-02-12",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/02/08/11662c12fb353d88bd2b20a2726c9f1c_8013472600677983943.png",
    "imagePath": "/character/yumemizuki_mizuki.png"
  },
  {
    "id": "traveler_pyro",
    "element": "Pyro",
    "rarity": 5,
    "weapon": "Sword",
    "region": "None",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/12/30/151578876/75bb898fe1c3b4ed29a2931829ddb845_1306153511401609506.png",
    "imagePath": "/character/traveler_pyro.png"
  },
  {
    "id": "lan_yan",
    "element": "Anemo",
    "rarity": 4,
    "weapon": "Catalyst",
    "region": "Liyue",
    "releaseDate": "2025-01-21",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/01/17/02a299cec38b4ef4f21952c37a624258_5744396397316809821.png",
    "imagePath": "/character/lan_yan.png"
  },
  {
    "id": "citlali",
    "element": "Cryo",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Natlan",
    "releaseDate": "2025-01-01",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/12/27/c4ab2530bb8bbe3c0e811684f97ec124_6688582217610741079.png",
    "imagePath": "/character/citlali.png"
  },
  {
    "id": "mavuika",
    "element": "Pyro",
    "rarity": 5,
    "weapon": "Claymore",
    "region": "Natlan",
    "releaseDate": "2025-01-01",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/12/30/2f098b1f15854fd9dafc54998795a59e_864981592196815761.png",
    "imagePath": "/character/mavuika.png"
  },
  {
    "id": "chasca",
    "element": "Anemo",
    "rarity": 5,
    "weapon": "Bow",
    "region": "Natlan",
    "releaseDate": "2024-11-20",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/11/18/abe1192cc7aad45f6b273478dd5fa88a_4799372826012752249.png",
    "imagePath": "/character/chasca.png"
  },
  {
    "id": "ororon",
    "element": "Electro",
    "rarity": 4,
    "weapon": "Bow",
    "region": "Natlan",
    "releaseDate": "2024-11-20",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/11/18/e4830690f8b6a1ebb02cfbc8ce955671_8091252479018770784.png",
    "imagePath": "/character/ororon.png"
  },
  {
    "id": "xilonen",
    "element": "Geo",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Natlan",
    "releaseDate": "2024-10-09",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/09/25/b07074c2b9040516fd240b6b8d65c011_2487211347344319683.png",
    "imagePath": "/character/xilonen.png"
  },
  {
    "id": "mualani",
    "element": "Hydro",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Natlan",
    "releaseDate": "2024-08-28",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/08/26/f4c75caad42923eb91ee760aa2eb473a_7439123622315070718.png",
    "imagePath": "/character/mualani.png"
  },
  {
    "id": "kachina",
    "element": "Geo",
    "rarity": 4,
    "weapon": "Polearm",
    "region": "Natlan",
    "releaseDate": "2024-08-28",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/08/23/26925adb1092d29c8afdf46d92fad8bd_343637410022641529.png",
    "imagePath": "/character/kachina.png"
  },
  {
    "id": "kinich",
    "element": "Dendro",
    "rarity": 5,
    "weapon": "Claymore",
    "region": "Natlan",
    "releaseDate": "2024-09-17",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/09/12/0099e74b4d0c919f6feab4bade3ab748_5795733017114624391.png",
    "imagePath": "/character/kinich.png"
  },
  {
    "id": "emilie",
    "element": "Dendro",
    "rarity": 5,
    "weapon": "Polearm",
    "region": "Fontaine",
    "releaseDate": "2024-08-06",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/07/31/87ad30965e0c1b45364fdccc51b3429d_6108610286145583716.png",
    "imagePath": "/character/emilie.png"
  },
  {
    "id": "sethos",
    "element": "Electro",
    "rarity": 4,
    "weapon": "Bow",
    "region": "Sumeru",
    "releaseDate": "2024-06-05",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/06/04/35428890/cdb7abfcb86138e5b618946a5466d442_6414132746291261116.png",
    "imagePath": "/character/sethos.png"
  },
  {
    "id": "sigewinne",
    "element": "Hydro",
    "rarity": 5,
    "weapon": "Bow",
    "region": "Fontaine",
    "releaseDate": "2024-06-25",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/06/26/35428890/2d607aa4d729030ea04f79919257e311_1172370997840232141.png",
    "imagePath": "/character/sigewinne.png"
  },
  {
    "id": "clorinde",
    "element": "Electro",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Fontaine",
    "releaseDate": "2024-06-05",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/06/04/35428890/770a66030815971c697ab81bc5436329_1296341861352728851.png",
    "imagePath": "/character/clorinde.png"
  },
  {
    "id": "arlecchino",
    "element": "Pyro",
    "rarity": 5,
    "weapon": "Polearm",
    "region": "Snezhnaya",
    "releaseDate": "2024-04-24",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/04/22/35428890/672e65470bfd14b664596c2a7f7eaaf8_7046130387894981792.png",
    "imagePath": "/character/arlecchino.png"
  },
  {
    "id": "chiori",
    "element": "Geo",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Inazuma",
    "releaseDate": "2024-03-13",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/03/11/35428890/5470f90694af13476e49be7b8346e2b1_5366587928381003654.png",
    "imagePath": "/character/chiori.png"
  },
  {
    "id": "gaming",
    "element": "Pyro",
    "rarity": 4,
    "weapon": "Claymore",
    "region": "Liyue",
    "releaseDate": "2024-01-31",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/01/29/35428890/b041ad23a9d6245efac952a9379c5114_8939761424130236195.png",
    "imagePath": "/character/gaming.png"
  },
  {
    "id": "xianyun",
    "element": "Anemo",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Liyue",
    "releaseDate": "2024-01-31",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/01/29/35428890/2c2be27f8876e9435ab8c8b933b8408c_7973851751945394462.png",
    "imagePath": "/character/xianyun.png"
  },
  {
    "id": "chevreuse",
    "element": "Pyro",
    "rarity": 4,
    "weapon": "Polearm",
    "region": "Fontaine",
    "releaseDate": "2024-01-09",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/01/09/35428890/a846729f31f16a987a8696466ebabcc0_6857330048220230431.png",
    "imagePath": "/character/chevreuse.png"
  },
  {
    "id": "navia",
    "element": "Geo",
    "rarity": 5,
    "weapon": "Claymore",
    "region": "Fontaine",
    "releaseDate": "2023-12-20",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2023/12/18/35428890/3fc7580c01a9e622692402889706c4db_8301615651200775487.png",
    "imagePath": "/character/navia.png"
  },
  {
    "id": "charlotte",
    "element": "Cryo",
    "rarity": 4,
    "weapon": "Catalyst",
    "region": "Fontaine",
    "releaseDate": "2023-11-08",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/11/06/35428890/7bbbff3f35661a93b5091b1f17fae6c0_6927814687713967999.png",
    "imagePath": "/character/charlotte.png"
  },
  {
    "id": "furina",
    "element": "Hydro",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Fontaine",
    "releaseDate": "2023-11-08",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/11/06/35428890/263e5ea0784d182b393f67a7e24146a5_2961704185113948066.png",
    "imagePath": "/character/furina.png"
  },
  {
    "id": "neuvillette",
    "element": "Hydro",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Fontaine",
    "releaseDate": "2023-09-27",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/09/26/35428890/0513aa7f482dbb4778545d02f94956fe_7540616405773975535.png",
    "imagePath": "/character/neuvillette.png"
  },
  {
    "id": "wriothesley",
    "element": "Cryo",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Fontaine",
    "releaseDate": "2023-10-17",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/10/15/35428890/31a0eb2dec5d69ca8dd7616572136b8b_8886987124386670150.png",
    "imagePath": "/character/wriothesley.png"
  },
  {
    "id": "traveler_hydro",
    "element": "Hydro",
    "rarity": 5,
    "weapon": "Sword",
    "region": "None",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/08/11/35428890/75bb898fe1c3b4ed29a2931829ddb845_5786491127494274034.png",
    "imagePath": "/character/traveler_hydro.png"
  },
  {
    "id": "freminet",
    "element": "Cryo",
    "rarity": 4,
    "weapon": "Claymore",
    "region": "Fontaine",
    "releaseDate": "2023-09-05",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/09/03/35428890/8e44111a378f4e5379b8e7444e8c2daa_4713775899437074849.png",
    "imagePath": "/character/freminet.png"
  },
  {
    "id": "lyney",
    "element": "Pyro",
    "rarity": 5,
    "weapon": "Bow",
    "region": "Fontaine",
    "releaseDate": "2023-08-16",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/08/11/35428890/e343d4442cc3b8e243f0d528bb715f75_1232011243947476013.png",
    "imagePath": "/character/lyney.png"
  },
  {
    "id": "lynette",
    "element": "Anemo",
    "rarity": 4,
    "weapon": "Sword",
    "region": "Fontaine",
    "releaseDate": "2023-08-16",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/08/14/35428890/436e6f2b9b9006bfe511a98093259daf_7192025380861185061.png",
    "imagePath": "/character/lynette.png"
  },
  {
    "id": "kirara",
    "element": "Dendro",
    "rarity": 4,
    "weapon": "Sword",
    "region": "Inazuma",
    "releaseDate": "2023-05-24",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/05/23/35428890/d1699810632f8c3bc8c1e8c8beb8250f_3141235252861584883.png",
    "imagePath": "/character/kirara.png"
  },
  {
    "id": "baizhu",
    "element": "Dendro",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Liyue",
    "releaseDate": "2023-05-02",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/05/02/35428890/05599650d7f42e1c4adde373de6b297d_8001303176243726128.png",
    "imagePath": "/character/baizhu.png"
  },
  {
    "id": "kaveh",
    "element": "Dendro",
    "rarity": 4,
    "weapon": "Claymore",
    "region": "Sumeru",
    "releaseDate": "2023-05-02",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/05/02/35428890/2270aba02b92034d7d76b4426be8f53b_7062168821433378650.png",
    "imagePath": "/character/kaveh.png"
  },
  {
    "id": "dehya",
    "element": "Pyro",
    "rarity": 5,
    "weapon": "Claymore",
    "region": "Sumeru",
    "releaseDate": "2023-03-01",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/02/24/35428890/65b22311e1e38ffa45a4928d4005ecee_7076295870986871517.png",
    "imagePath": "/character/dehya.png"
  },
  {
    "id": "mika",
    "element": "Cryo",
    "rarity": 4,
    "weapon": "Polearm",
    "region": "Mondstadt",
    "releaseDate": "2023-03-21",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/03/21/35428890/da13e3b1a2c6c0e5892b201cec735f9b_6392765476968311284.png",
    "imagePath": "/character/mika.png"
  },
  {
    "id": "alhaitham",
    "element": "Dendro",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Sumeru",
    "releaseDate": "2023-01-18",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/01/15/35428890/25249dd20b86c775fb35bdbbd805d9ec_8879881358376735994.png",
    "imagePath": "/character/alhaitham.png"
  },
  {
    "id": "yaoyao",
    "element": "Dendro",
    "rarity": 4,
    "weapon": "Polearm",
    "region": "Liyue",
    "releaseDate": "2023-01-18",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/01/15/35428890/5bc9df1fb67391e4c8080da3d855de53_8974356791001371659.png",
    "imagePath": "/character/yaoyao.png"
  },
  {
    "id": "wanderer",
    "element": "Anemo",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Sumeru",
    "releaseDate": "2022-12-07",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/12/05/35428890/24d97a22be742fb732ea96f625d1faac_2495743636540582085.png",
    "imagePath": "/character/wanderer.png"
  },
  {
    "id": "faruzan",
    "element": "Anemo",
    "rarity": 4,
    "weapon": "Bow",
    "region": "Sumeru",
    "releaseDate": "2022-12-07",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/12/05/35428890/38c12ab46678a4008f83a0e46c900ef5_528211919348170763.png",
    "imagePath": "/character/faruzan.png"
  },
  {
    "id": "layla",
    "element": "Cryo",
    "rarity": 4,
    "weapon": "Sword",
    "region": "Sumeru",
    "releaseDate": "2022-11-18",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/11/15/35428890/48a495acadaf37f12d0a7f653d85bd83_7085430198590697354.png",
    "imagePath": "/character/layla.png"
  },
  {
    "id": "nahida",
    "element": "Dendro",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Sumeru",
    "releaseDate": "2022-11-02",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/10/29/35428890/f29490bddc56b4a6773b6c5003bbb853_9091170755650648414.png",
    "imagePath": "/character/nahida.png"
  },
  {
    "id": "candace",
    "element": "Hydro",
    "rarity": 4,
    "weapon": "Polearm",
    "region": "Sumeru",
    "releaseDate": "2022-09-28",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/09/28/77454259/2f43da4ece9eabfbde6ec2fcc81b3bff_6412967003441390014.png",
    "imagePath": "/character/candace.png"
  },
  {
    "id": "cyno",
    "element": "Electro",
    "rarity": 5,
    "weapon": "Polearm",
    "region": "Sumeru",
    "releaseDate": "2022-09-28",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/09/28/77454259/e09e2bda5e022611fad0dea1bb6518bb_6757667565719577204.png",
    "imagePath": "/character/cyno.png"
  },
  {
    "id": "nilou",
    "element": "Hydro",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Sumeru",
    "releaseDate": "2022-10-14",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/10/10/35428890/586d726f9ebda3506c78beaaa41f13b6_5916447718992361520.png",
    "imagePath": "/character/nilou.png"
  },
  {
    "id": "traveler_dendro",
    "element": "Dendro",
    "rarity": 5,
    "weapon": "Sword",
    "region": "None",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/08/23/169177528/04f769b0b1671b5ffbbafefd7286b4b2_4670164833306961502.png",
    "imagePath": "/character/traveler_dendro.png"
  },
  {
    "id": "dori",
    "element": "Electro",
    "rarity": 4,
    "weapon": "Claymore",
    "region": "Sumeru",
    "releaseDate": "2022-09-09",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/09/08/35428890/6539bea71efd0f839db897cfc4094362_3469125131800075941.png",
    "imagePath": "/character/dori.png"
  },
  {
    "id": "collei",
    "element": "Dendro",
    "rarity": 4,
    "weapon": "Bow",
    "region": "Sumeru",
    "releaseDate": "2022-08-24",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/08/24/194600931/37a18b6b6865c59063003a9380f08225_7758071773430345954.png",
    "imagePath": "/character/collei.png"
  },
  {
    "id": "tighnari",
    "element": "Dendro",
    "rarity": 5,
    "weapon": "Bow",
    "region": "Sumeru",
    "releaseDate": "2022-08-24",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/08/22/35428890/497dd6fac3d3c652a367c67428550747_306268558608889633.png",
    "imagePath": "/character/tighnari.png"
  },
  {
    "id": "shikanoin_heizou",
    "element": "Anemo",
    "rarity": 4,
    "weapon": "Catalyst",
    "region": "Inazuma",
    "releaseDate": "2022-07-13",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Shikanoin%2520Heizou_icon.png",
    "imagePath": "/character/shikanoin_heizou.png"
  },
  {
    "id": "kuki_shinobu",
    "element": "Electro",
    "rarity": 4,
    "weapon": "Sword",
    "region": "Inazuma",
    "releaseDate": "2022-06-21",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Kuki%2520Shinobu_icon.png",
    "imagePath": "/character/kuki_shinobu.png"
  },
  {
    "id": "yelan",
    "element": "Hydro",
    "rarity": 5,
    "weapon": "Bow",
    "region": "Liyue",
    "releaseDate": "2022-05-31",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Yelan_icon.png",
    "imagePath": "/character/yelan.png"
  },
  {
    "id": "xiao",
    "element": "Anemo",
    "rarity": 5,
    "weapon": "Polearm",
    "region": "Liyue",
    "releaseDate": "2021-02-03",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Xiao_icon.png",
    "imagePath": "/character/xiao.png"
  },
  {
    "id": "xiangling",
    "element": "Pyro",
    "rarity": 4,
    "weapon": "Polearm",
    "region": "Liyue",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Xiangling_icon.png",
    "imagePath": "/character/xiangling.png"
  },
  {
    "id": "raiden_shogun",
    "element": "Electro",
    "rarity": 5,
    "weapon": "Polearm",
    "region": "Inazuma",
    "releaseDate": "2021-09-01",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Raiden%2520Shogun_icon.png",
    "imagePath": "/character/raiden_shogun.png"
  },
  {
    "id": "razor",
    "element": "Electro",
    "rarity": 4,
    "weapon": "Claymore",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Razor_icon.png",
    "imagePath": "/character/razor.png"
  },
  {
    "id": "albedo",
    "element": "Geo",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Mondstadt",
    "releaseDate": "2020-12-23",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Albedo_icon.png",
    "imagePath": "/character/albedo.png"
  },
  {
    "id": "zhongli",
    "element": "Geo",
    "rarity": 5,
    "weapon": "Polearm",
    "region": "Liyue",
    "releaseDate": "2020-12-01",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Zhongli_icon.png",
    "imagePath": "/character/zhongli.png"
  },
  {
    "id": "chongyun",
    "element": "Cryo",
    "rarity": 4,
    "weapon": "Claymore",
    "region": "Liyue",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Chongyun_icon.png",
    "imagePath": "/character/chongyun.png"
  },
  {
    "id": "diona",
    "element": "Cryo",
    "rarity": 4,
    "weapon": "Bow",
    "region": "Mondstadt",
    "releaseDate": "2020-11-11",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Diona_icon.png",
    "imagePath": "/character/diona.png"
  },
  {
    "id": "diluc",
    "element": "Pyro",
    "rarity": 5,
    "weapon": "Claymore",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Diluc_icon.png",
    "imagePath": "/character/diluc.png"
  },
  {
    "id": "tartaglia",
    "element": "Hydro",
    "rarity": 5,
    "weapon": "Bow",
    "region": "Snezhnaya",
    "releaseDate": "2020-11-11",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Tartaglia_icon.png",
    "imagePath": "/character/tartaglia.png"
  },
  {
    "id": "xinyan",
    "element": "Pyro",
    "rarity": 4,
    "weapon": "Claymore",
    "region": "Liyue",
    "releaseDate": "2020-12-01",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Xinyan_icon.png",
    "imagePath": "/character/xinyan.png"
  },
  {
    "id": "noelle",
    "element": "Geo",
    "rarity": 4,
    "weapon": "Claymore",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Noelle_icon.png",
    "imagePath": "/character/noelle.png"
  },
  {
    "id": "xingqiu",
    "element": "Hydro",
    "rarity": 4,
    "weapon": "Sword",
    "region": "Liyue",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Xingqiu_icon.png",
    "imagePath": "/character/xingqiu.png"
  },
  {
    "id": "fischl",
    "element": "Electro",
    "rarity": 4,
    "weapon": "Bow",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Fischl_icon.png",
    "imagePath": "/character/fischl.png"
  },
  {
    "id": "mona",
    "element": "Hydro",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Mona_icon.png",
    "imagePath": "/character/mona.png"
  },
  {
    "id": "arataki_itto",
    "element": "Geo",
    "rarity": 5,
    "weapon": "Claymore",
    "region": "Inazuma",
    "releaseDate": "2021-12-14",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Arataki%2520Itto_icon.png",
    "imagePath": "/character/arataki_itto.png"
  },
  {
    "id": "barbara",
    "element": "Hydro",
    "rarity": 4,
    "weapon": "Catalyst",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Barbara_icon.png",
    "imagePath": "/character/barbara.png"
  },
  {
    "id": "hu_tao",
    "element": "Pyro",
    "rarity": 5,
    "weapon": "Polearm",
    "region": "Liyue",
    "releaseDate": "2021-03-02",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Hu%2520Tao_icon.png",
    "imagePath": "/character/hu_tao.png"
  },
  {
    "id": "rosaria",
    "element": "Cryo",
    "rarity": 4,
    "weapon": "Polearm",
    "region": "Mondstadt",
    "releaseDate": "2021-04-06",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Rosaria_icon.png",
    "imagePath": "/character/rosaria.png"
  },
  {
    "id": "kamisato_ayaka",
    "element": "Cryo",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Inazuma",
    "releaseDate": "2021-07-21",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Kamisato%2520Ayaka_icon.png",
    "imagePath": "/character/kamisato_ayaka.png"
  },
  {
    "id": "kamisato_ayato",
    "element": "Hydro",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Inazuma",
    "releaseDate": "2022-03-30",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Kamisato%2520Ayato_icon.png",
    "imagePath": "/character/kamisato_ayato.png"
  },
  {
    "id": "sucrose",
    "element": "Anemo",
    "rarity": 4,
    "weapon": "Catalyst",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Sucrose_icon.png",
    "imagePath": "/character/sucrose.png"
  },
  {
    "id": "shenhe",
    "element": "Cryo",
    "rarity": 5,
    "weapon": "Polearm",
    "region": "Liyue",
    "releaseDate": "2022-01-05",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Shenhe_icon.png",
    "imagePath": "/character/shenhe.png"
  },
  {
    "id": "ganyu",
    "element": "Cryo",
    "rarity": 5,
    "weapon": "Bow",
    "region": "Liyue",
    "releaseDate": "2021-01-12",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/03/12/35428890/797ded201635d241d358c307e9e7417f_464481961971717418.png",
    "imagePath": "/character/ganyu.png"
  },
  {
    "id": "jean",
    "element": "Anemo",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Jean_icon.png",
    "imagePath": "/character/jean.png"
  },
  {
    "id": "bennett",
    "element": "Pyro",
    "rarity": 4,
    "weapon": "Sword",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Bennett_icon.png",
    "imagePath": "/character/bennett.png"
  },
  {
    "id": "sangonomiya_kokomi",
    "element": "Hydro",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Inazuma",
    "releaseDate": "2021-09-21",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Sangonomiya%2520Kokomi_icon.png",
    "imagePath": "/character/sangonomiya_kokomi.png"
  },
  {
    "id": "yanfei",
    "element": "Pyro",
    "rarity": 4,
    "weapon": "Catalyst",
    "region": "Liyue",
    "releaseDate": "2021-04-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Yanfei_icon.png",
    "imagePath": "/character/yanfei.png"
  },
  {
    "id": "venti",
    "element": "Anemo",
    "rarity": 5,
    "weapon": "Bow",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Venti_icon.png",
    "imagePath": "/character/venti.png"
  },
  {
    "id": "kaedehara_kazuha",
    "element": "Anemo",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Inazuma",
    "releaseDate": "2021-06-29",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Kaedehara%2520Kazuha_icon.png",
    "imagePath": "/character/kaedehara_kazuha.png"
  },
  {
    "id": "sayu",
    "element": "Anemo",
    "rarity": 4,
    "weapon": "Claymore",
    "region": "Inazuma",
    "releaseDate": "2021-08-10",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Sayu_icon.png",
    "imagePath": "/character/sayu.png"
  },
  {
    "id": "traveler_anemo",
    "element": "Anemo",
    "rarity": 5,
    "weapon": "Sword",
    "region": "None",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Traveler_icon.png",
    "imagePath": "/character/traveler_anemo.png"
  },
  {
    "id": "traveler_electro",
    "element": "Electro",
    "rarity": 5,
    "weapon": "Sword",
    "region": "None",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Traveler_icon.png",
    "imagePath": "/character/traveler_electro.png"
  },
  {
    "id": "traveler_geo",
    "element": "Geo",
    "rarity": 5,
    "weapon": "Sword",
    "region": "None",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Traveler_icon.png",
    "imagePath": "/character/traveler_geo.png"
  },
  {
    "id": "thoma",
    "element": "Pyro",
    "rarity": 4,
    "weapon": "Polearm",
    "region": "Inazuma",
    "releaseDate": "2021-11-02",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Thoma_icon.png",
    "imagePath": "/character/thoma.png"
  },
  {
    "id": "yoimiya",
    "element": "Pyro",
    "rarity": 5,
    "weapon": "Bow",
    "region": "Inazuma",
    "releaseDate": "2021-08-10",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Yoimiya_icon.png",
    "imagePath": "/character/yoimiya.png"
  },
  {
    "id": "amber",
    "element": "Pyro",
    "rarity": 4,
    "weapon": "Bow",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Amber_icon.png",
    "imagePath": "/character/amber.png"
  },
  {
    "id": "aloy",
    "element": "Cryo",
    "rarity": 5,
    "weapon": "Bow",
    "region": "None",
    "releaseDate": "2021-09-01",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/11/19/80830045/1fb2086af3c7933af37eda1ff9084317_163049704110308134.png",
    "imagePath": "/character/aloy.png"
  },
  {
    "id": "klee",
    "element": "Pyro",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Mondstadt",
    "releaseDate": "2020-10-20",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Klee_icon.png",
    "imagePath": "/character/klee.png"
  },
  {
    "id": "beidou",
    "element": "Electro",
    "rarity": 4,
    "weapon": "Claymore",
    "region": "Liyue",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Beidou_icon.png",
    "imagePath": "/character/beidou.png"
  },
  {
    "id": "keqing",
    "element": "Electro",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Liyue",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Keqing_icon.png",
    "imagePath": "/character/keqing.png"
  },
  {
    "id": "kaeya",
    "element": "Cryo",
    "rarity": 4,
    "weapon": "Sword",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Kaeya_icon.png",
    "imagePath": "/character/kaeya.png"
  },
  {
    "id": "ningguang",
    "element": "Geo",
    "rarity": 4,
    "weapon": "Catalyst",
    "region": "Liyue",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Ningguang_icon.png",
    "imagePath": "/character/ningguang.png"
  },
  {
    "id": "yae_miko",
    "element": "Electro",
    "rarity": 5,
    "weapon": "Catalyst",
    "region": "Inazuma",
    "releaseDate": "2022-02-16",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Yae%2520Miko_icon.png",
    "imagePath": "/character/yae_miko.png"
  },
  {
    "id": "eula",
    "element": "Cryo",
    "rarity": 5,
    "weapon": "Claymore",
    "region": "Mondstadt",
    "releaseDate": "2021-05-18",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Eula_icon.png",
    "imagePath": "/character/eula.png"
  },
  {
    "id": "gorou",
    "element": "Geo",
    "rarity": 4,
    "weapon": "Bow",
    "region": "Inazuma",
    "releaseDate": "2021-12-14",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Gorou_icon.png",
    "imagePath": "/character/gorou.png"
  },
  {
    "id": "yun_jin",
    "element": "Geo",
    "rarity": 4,
    "weapon": "Polearm",
    "region": "Liyue",
    "releaseDate": "2022-01-05",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Yun%2520Jin_icon.png",
    "imagePath": "/character/yun_jin.png"
  },
  {
    "id": "kujou_sara",
    "element": "Electro",
    "rarity": 4,
    "weapon": "Bow",
    "region": "Inazuma",
    "releaseDate": "2021-09-01",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Kujou%2520Sara_icon.png",
    "imagePath": "/character/kujou_sara.png"
  },
  {
    "id": "lisa",
    "element": "Electro",
    "rarity": 4,
    "weapon": "Catalyst",
    "region": "Mondstadt",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Lisa_icon.png",
    "imagePath": "/character/lisa.png"
  },
  {
    "id": "qiqi",
    "element": "Cryo",
    "rarity": 5,
    "weapon": "Sword",
    "region": "Liyue",
    "releaseDate": "2020-09-28",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/character/Qiqi_icon.png",
    "imagePath": "/character/qiqi.png"
  }
];

// Artifacts data
export const artifacts: ArtifactSet[] = [
  {
    "id": "silken_moons_serenade",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/09/01/b8350998129a66e67c1a7691153da68d_6559589601591776539.png",
    "imagePath": "/artifact/silken_moons_serenade.png"
  },
  {
    "id": "night_of_the_skys_unveiling",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/09/01/25c4512875bad223765a5a32c82b09a4_7122872897984003318.png",
    "imagePath": "/artifact/night_of_the_skys_unveiling.png"
  },
  {
    "id": "finale_of_the_deep_galleries",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/03/17/bf39402f87db1168263c7c0898c8ab0c_4434336707917443666.png",
    "imagePath": "/artifact/finale_of_the_deep_galleries.png"
  },
  {
    "id": "long_nights_oath",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/03/17/3cf2511dfb1f91696a0ee986e5f1fb22_3371878648281977517.png",
    "imagePath": "/artifact/long_nights_oath.png"
  },
  {
    "id": "obsidian_codex",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/08/25/35428890/cd11df3be5420d2c53c2da0d3298eb92_1095952715486440137.png",
    "imagePath": "/artifact/obsidian_codex.png"
  },
  {
    "id": "scroll_of_the_hero_of_cinder_city",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/08/25/35428890/6ad5095f324c2da829ecaa5e2ed13af9_552940265782217486.png",
    "imagePath": "/artifact/scroll_of_the_hero_of_cinder_city.png"
  },
  {
    "id": "unfinished_reverie",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/04/22/35428890/356c6b0e1be129282f759d8844872c7d_544884929456263860.png",
    "imagePath": "/artifact/unfinished_reverie.png"
  },
  {
    "id": "fragment_of_harmonic_whimsy",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2024/04/22/35428890/7557f4558ab243d82e8b6b9994fc97ee_3952883455179155002.png",
    "imagePath": "/artifact/fragment_of_harmonic_whimsy.png"
  },
  {
    "id": "song_of_days_past",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2023/12/18/35428890/7789fb5e684cf95a7011657d0fa8a971_4912719626191046540.png",
    "imagePath": "/artifact/song_of_days_past.png"
  },
  {
    "id": "nighttime_whispers_in_the_echoing_woods",
    "imageUrl": "https://act-upload.hoyoverse.com/event-ugc-hoyowiki/2023/12/18/35428890/d9d39d9f046d5d23c3d497574be55a82_6651989566067939894.png",
    "imagePath": "/artifact/nighttime_whispers_in_the_echoing_woods.png"
  },
  {
    "id": "golden_troupe",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/08/14/35428890/c32bab10651059ad3c0c8a0e5bbd2e03_1977006170352048486.png",
    "imagePath": "/artifact/golden_troupe.png"
  },
  {
    "id": "marechaussee_hunter",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/08/14/35428890/539b03bed1057707abd643147e18abde_6521945376578667972.png",
    "imagePath": "/artifact/marechaussee_hunter.png"
  },
  {
    "id": "vourukashas_glow",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/04/10/35428890/bc9329baf36935b2fb094f783a7695f2_5409606138062221441.png",
    "imagePath": "/artifact/vourukashas_glow.png"
  },
  {
    "id": "nymphs_dream",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2023/04/10/35428890/1bde348ad550ef356ff197b93caed6c8_1659289996356186854.png",
    "imagePath": "/artifact/nymphs_dream.png"
  },
  {
    "id": "desert_pavilion_chronicle",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/12/05/35428890/b86d9fd7cf57937a021c9c68c9b185ed_8273785812548801718.png",
    "imagePath": "/artifact/desert_pavilion_chronicle.png"
  },
  {
    "id": "flower_of_paradise_lost",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/12/05/35428890/50ce09dfa5a91a33aa9cedfb15bcf2d1_864016614991586234.png",
    "imagePath": "/artifact/flower_of_paradise_lost.png"
  },
  {
    "id": "gilded_dreams",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/08/23/194600931/ae8a2c6f24df66e1bd7cc2dbd83d330d_5836084318530605114.png",
    "imagePath": "/artifact/gilded_dreams.png"
  },
  {
    "id": "deepwood_memories",
    "imageUrl": "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/08/23/194600931/f526e111c9c7dcbaed0d7fd8c8d58ef2_6545580301650182707.png",
    "imagePath": "/artifact/deepwood_memories.png"
  },
  {
    "id": "retracing_bolide",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Retracing%2520Bolide/flower_of_life_icon.png",
    "imagePath": "/artifact/retracing_bolide.png"
  },
  {
    "id": "shimenawas_reminiscence",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Shimenawa's%2520Reminiscence/flower_of_life_icon.png",
    "imagePath": "/artifact/shimenawas_reminiscence.png"
  },
  {
    "id": "vermillion_hereafter",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Vermillion%2520Hereafter/flower_of_life_icon.png",
    "imagePath": "/artifact/vermillion_hereafter.png"
  },
  {
    "id": "gladiators_finale",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Gladiator's%2520Finale/flower_of_life_icon.png",
    "imagePath": "/artifact/gladiators_finale.png"
  },
  {
    "id": "maiden_beloved",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Maiden%2520Beloved/flower_of_life_icon.png",
    "imagePath": "/artifact/maiden_beloved.png"
  },
  {
    "id": "pale_flame",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Pale%2520Flame/flower_of_life_icon.png",
    "imagePath": "/artifact/pale_flame.png"
  },
  {
    "id": "viridescent_venerer",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Viridescent%2520Venerer/flower_of_life_icon.png",
    "imagePath": "/artifact/viridescent_venerer.png"
  },
  {
    "id": "emblem_of_severed_fate",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Emblem%2520of%2520Severed%2520Fate/flower_of_life_icon.png",
    "imagePath": "/artifact/emblem_of_severed_fate.png"
  },
  {
    "id": "crimson_witch_of_flames",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Crimson%2520Witch%2520of%2520Flames/flower_of_life_icon.png",
    "imagePath": "/artifact/crimson_witch_of_flames.png"
  },
  {
    "id": "lavawalker",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Lavawalker/flower_of_life_icon.png",
    "imagePath": "/artifact/lavawalker.png"
  },
  {
    "id": "oceanhued_clam",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Ocean-Hued%2520Clam/flower_of_life_icon.png",
    "imagePath": "/artifact/oceanhued_clam.png"
  },
  {
    "id": "wanderers_troupe",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Wanderer's%2520Troupe/flower_of_life_icon.png",
    "imagePath": "/artifact/wanderers_troupe.png"
  },
  {
    "id": "heart_of_depth",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Heart%2520of%2520Depth/flower_of_life_icon.png",
    "imagePath": "/artifact/heart_of_depth.png"
  },
  {
    "id": "bloodstained_chivalry",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Bloodstained%2520Chivalry/flower_of_life_icon.png",
    "imagePath": "/artifact/bloodstained_chivalry.png"
  },
  {
    "id": "echoes_of_an_offering",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Echoes%2520of%2520an%2520Offering/flower_of_life_icon.png",
    "imagePath": "/artifact/echoes_of_an_offering.png"
  },
  {
    "id": "noblesse_oblige",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Noblesse%2520Oblige/flower_of_life_icon.png",
    "imagePath": "/artifact/noblesse_oblige.png"
  },
  {
    "id": "instructor",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Instructor/flower_of_life_icon.png",
    "imagePath": "/artifact/instructor.png"
  },
  {
    "id": "archaic_petra",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Archaic%2520Petra/flower_of_life_icon.png",
    "imagePath": "/artifact/archaic_petra.png"
  },
  {
    "id": "thundersoother",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Thundersoother/flower_of_life_icon.png",
    "imagePath": "/artifact/thundersoother.png"
  },
  {
    "id": "thundering_fury",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Thundering%2520Fury/flower_of_life_icon.png",
    "imagePath": "/artifact/thundering_fury.png"
  },
  {
    "id": "husk_of_opulent_dreams",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Husk%2520of%2520Opulent%2520Dreams/flower_of_life_icon.png",
    "imagePath": "/artifact/husk_of_opulent_dreams.png"
  },
  {
    "id": "tenacity_of_the_millelith",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Tenacity%2520of%2520the%2520Millelith/flower_of_life_icon.png",
    "imagePath": "/artifact/tenacity_of_the_millelith.png"
  },
  {
    "id": "blizzard_strayer",
    "imageUrl": "https://wiki.hoyolab.com/_ipx/f_webp/https://bbs.hoyolab.com/hoyowiki/picture/reliquary/Blizzard%2520Strayer/flower_of_life_icon.png",
    "imagePath": "/artifact/blizzard_strayer.png"
  }
];

// Artifact half sets data
export const artifactHalfSets: ArtifactHalfSet[] = [
  {
    "id": 9,
    "setIds": [
      "echoes_of_an_offering",
      "gladiators_finale",
      "vermillion_hereafter",
      "shimenawas_reminiscence",
      "nighttime_whispers_in_the_echoing_woods",
      "fragment_of_harmonic_whimsy",
      "unfinished_reverie"
    ],
    "normalizedEffectTextEn": "ATK +18%",
    "normalizedEffectTextZh": "攻击力提高18%"
  },
  {
    "id": 7,
    "setIds": [
      "instructor",
      "wanderers_troupe",
      "gilded_dreams",
      "flower_of_paradise_lost",
      "night_of_the_skys_unveiling"
    ],
    "normalizedEffectTextEn": "Elemental Mastery +80",
    "normalizedEffectTextZh": "元素精通提高80点"
  },
  {
    "id": 16,
    "setIds": [
      "viridescent_venerer",
      "desert_pavilion_chronicle"
    ],
    "normalizedEffectTextEn": "Anemo DMG Bonus +15%",
    "normalizedEffectTextZh": "获得15%风元素伤害加成"
  },
  {
    "id": 15,
    "setIds": [
      "emblem_of_severed_fate",
      "silken_moons_serenade"
    ],
    "normalizedEffectTextEn": "Energy Recharge +20%",
    "normalizedEffectTextZh": "元素充能效率提高20%"
  },
  {
    "id": 12,
    "setIds": [
      "oceanhued_clam",
      "song_of_days_past"
    ],
    "normalizedEffectTextEn": "Healing Bonus +15%",
    "normalizedEffectTextZh": "治疗加成提高15%"
  },
  {
    "id": 11,
    "setIds": [
      "heart_of_depth",
      "nymphs_dream"
    ],
    "normalizedEffectTextEn": "Hydro DMG Bonus +15%",
    "normalizedEffectTextZh": "获得15%水元素伤害加成"
  },
  {
    "id": 10,
    "setIds": [
      "bloodstained_chivalry",
      "pale_flame"
    ],
    "normalizedEffectTextEn": "Physical DMG +25%",
    "normalizedEffectTextZh": "造成的物理伤害提高25%"
  },
  {
    "id": 2,
    "setIds": [
      "tenacity_of_the_millelith",
      "vourukashas_glow"
    ],
    "normalizedEffectTextEn": "HP +20%",
    "normalizedEffectTextZh": "生命值提升20%"
  },
  {
    "id": 1,
    "setIds": [
      "blizzard_strayer",
      "finale_of_the_deep_galleries"
    ],
    "normalizedEffectTextEn": "Cryo DMG Bonus +15%",
    "normalizedEffectTextZh": "获得15%冰元素伤害加成"
  },
  {
    "id": 24,
    "setIds": [
      "long_nights_oath"
    ],
    "normalizedEffectTextEn": "Plunging Attack DMG increased by 25%",
    "normalizedEffectTextZh": "下落攻击造成的伤害提升25%"
  },
  {
    "id": 23,
    "setIds": [
      "obsidian_codex"
    ],
    "normalizedEffectTextEn": "While the equipping character is in Nightsoul's Blessing and is on the field, their DMG dealt is increased by 15%",
    "normalizedEffectTextZh": "装备者处于夜魂加持状态，并且在场上时，造成的伤害提高15%"
  },
  {
    "id": 22,
    "setIds": [
      "scroll_of_the_hero_of_cinder_city"
    ],
    "normalizedEffectTextEn": "When a nearby party member triggers a Nightsoul Burst, the equipping character regenerates 6 Energy",
    "normalizedEffectTextZh": "队伍中附近的角色触发「夜魂迸发」时，装备者恢复6点元素能量"
  },
  {
    "id": 21,
    "setIds": [
      "golden_troupe"
    ],
    "normalizedEffectTextEn": "Increases Elemental Skill DMG by 20%",
    "normalizedEffectTextZh": "元素战技造成的伤害提升20%"
  },
  {
    "id": 20,
    "setIds": [
      "marechaussee_hunter"
    ],
    "normalizedEffectTextEn": "Normal and Charged Attack DMG +15%",
    "normalizedEffectTextZh": "普通攻击与重击造成的伤害提高15%"
  },
  {
    "id": 19,
    "setIds": [
      "deepwood_memories"
    ],
    "normalizedEffectTextEn": "Dendro DMG Bonus +15%",
    "normalizedEffectTextZh": "获得15%草元素伤害加成"
  },
  {
    "id": 18,
    "setIds": [
      "retracing_bolide"
    ],
    "normalizedEffectTextEn": "Increases Shield Strength by 35%",
    "normalizedEffectTextZh": "护盾强效提高35%"
  },
  {
    "id": 17,
    "setIds": [
      "maiden_beloved"
    ],
    "normalizedEffectTextEn": "Character Healing Effectiveness +15%",
    "normalizedEffectTextZh": "角色造成的治疗效果提升15%"
  },
  {
    "id": 14,
    "setIds": [
      "crimson_witch_of_flames"
    ],
    "normalizedEffectTextEn": "Pyro DMG Bonus +15%",
    "normalizedEffectTextZh": "获得15%火元素伤害加成"
  },
  {
    "id": 13,
    "setIds": [
      "lavawalker"
    ],
    "normalizedEffectTextEn": "Pyro RES increased by 40%",
    "normalizedEffectTextZh": "火元素抗性提高40%"
  },
  {
    "id": 8,
    "setIds": [
      "noblesse_oblige"
    ],
    "normalizedEffectTextEn": "Elemental Burst DMG +20%",
    "normalizedEffectTextZh": "元素爆发造成的伤害提升20%"
  },
  {
    "id": 6,
    "setIds": [
      "archaic_petra"
    ],
    "normalizedEffectTextEn": "Gain a 15% Geo DMG Bonus",
    "normalizedEffectTextZh": "获得15%岩元素伤害加成"
  },
  {
    "id": 5,
    "setIds": [
      "thundersoother"
    ],
    "normalizedEffectTextEn": "Electro RES increased by 40%",
    "normalizedEffectTextZh": "雷元素抗性提高40%"
  },
  {
    "id": 4,
    "setIds": [
      "thundering_fury"
    ],
    "normalizedEffectTextEn": "Electro DMG Bonus +15%",
    "normalizedEffectTextZh": "获得15%雷元素伤害加成"
  },
  {
    "id": 3,
    "setIds": [
      "husk_of_opulent_dreams"
    ],
    "normalizedEffectTextEn": "DEF +30%",
    "normalizedEffectTextZh": "防御力提高30%"
  }
];

// Elements data
export const elements: ElementResource[] = [
  {
    "name": "Pyro",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/03/27/ac3123b42bf631685287e76c8c834a6c_564491877314389852.png",
    "imagePath": "/element/pyro.png"
  },
  {
    "name": "Hydro",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/03/27/f54c8f0dae23fced358c28126f220a11_8997562060019157249.png",
    "imagePath": "/element/hydro.png"
  },
  {
    "name": "Dendro",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/03/27/bda7c6cf71ea059c6abc086405a7cdd5_1717146848708050949.png",
    "imagePath": "/element/dendro.png"
  },
  {
    "name": "Electro",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/03/27/16d344b6abbc369a2db9d46d6f31305b_7144738962629629573.png",
    "imagePath": "/element/electro.png"
  },
  {
    "name": "Anemo",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/03/27/6b5c0d861fd1b4791bd602d3e7296598_8700657350379813969.png",
    "imagePath": "/element/anemo.png"
  },
  {
    "name": "Cryo",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/03/27/157c22f5fd473d3c1684c6ee981540b6_1601711336893201442.png",
    "imagePath": "/element/cryo.png"
  },
  {
    "name": "Geo",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/03/27/9c4cd6e14b87fc262cca36e6d0e9bdb0_1526899214861833594.png",
    "imagePath": "/element/geo.png"
  }
];

// Weapons data
export const weapons: WeaponResource[] = [
  {
    "name": "Sword",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/03/27/eb8602badf0ade7c03650a440d188ce1_4346782947893420142.png",
    "imagePath": "/weapon/sword.png"
  },
  {
    "name": "Claymore",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/03/27/4b65ed8d8fd30705265fa10ee65c8b61_7363045695641018717.png",
    "imagePath": "/weapon/claymore.png"
  },
  {
    "name": "Bow",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/03/27/e38debacfd0147020895322333ea9d2a_4867338674175003782.png",
    "imagePath": "/weapon/bow.png"
  },
  {
    "name": "Catalyst",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/03/27/91c80bbf63e574fc6d6b1cb8563cf8e3_5665224225336557820.png",
    "imagePath": "/weapon/catalyst.png"
  },
  {
    "name": "Polearm",
    "imageUrl": "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2024/03/27/9c0f0c167f2753035b78c0aed9f01b9f_3170160339356492715.png",
    "imagePath": "/weapon/polearm.png"
  }
];

export const charactersById = characters.reduce((acc, char) => {
  acc[char.id] = char;
  return acc;
}, {} as Record<string, Character>);
