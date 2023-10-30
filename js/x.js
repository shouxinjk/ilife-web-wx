var client = "web";
// 文档加载完毕后执行
$(document).ready(function ()
{
    //根据屏幕大小判定是移动端还是桌面
    const oHtml = document.getElementsByTagName('html')[0]
    const width = oHtml.clientWidth;
    if(width<800){
       client = "wap";
    }
    var args = getQuery();//获取参数
    var code = args["x"]?args["x"]:0;//x为短码

    broker = util.getBrokerInfo();

    checkShortCode(code);
});

var broker = {};//记录当前达人：注意，避免交互，仅检查cookie

//记录分享用户、分享达人
var from = "mp";//链接来源，默认为公众号进入
var fromUser = "";
var fromBroker = "";

//根据短码查询Qrcode URL地址信息，包括对应小程序APPId及二维码链接
function checkShortCode(shortCode){//获取详细内容
    $.ajax({
        url:app.config.analyze_api+"?query=select itemType,itemId,platform,appId,longUrl,qrcodeUrl,shortCode from ilife.qrcodes where shortCode='"+shortCode+"' limit 1 format JSON",
        type:"get",
        //async:false,//同步调用
        data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },  
        success:function(res){
            console.log("===got long url info===\n",res);
            var json = {};
            if(res.rows>0){
                json = res.data[0];
            }

            from = json&&json.channel?json.channel:"mp";//可能为groupmessage,timeline等
            fromUser = json&&json.fromUser?json.fromUser:"";//从连接中获取分享用户ID
            fromBroker = json&&json.fromBroker?json.fromBroker:"";//从连接中获取分享达人ID。重要：将依据此进行收益计算

            //如果未指定fromBroker，则检查首次触达达人
            if(!fromBroker || fromBroker=="" || fromBroker.trim().length==0){
                fromBroker = util.getInitBroker();
            }

            if(json&&json.qrcodeUrl&&json.qrcodeUrl.trim().length>0){// 当前直接展示小程序二维码，仅作为跳转桥梁。未衔接B端商品发布
                window.location.href = json.qrcodeUrl; //页面直接显示一个二维码
            }else{//跳转到首页
                console.log("target item cannot find. jump to index.",json);
                window.location.href = "index.html";
            }
        }
    });  
}


