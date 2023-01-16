//显示顶部用户信息
function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="info-general">';
    html += '<img class="general-icon" src="'+person.avatarUrl+'" height="60px"/>';
    html += '</div>';
    html += '<div class="info-detail">';
    html += '<div class="info-text info-blank">'+person.nickName+'</div>';
    html += '<div class="info-text info-blank" id="brokerHint" style="display:flex;flex-direction:row;align-items:center;flex-wrap:nowrap;">'+(person.province?person.province:"")+(person.city?(" "+person.city):"")+'</div>';
    html += '<div class="info-text info-blank" id="brokerLink" style="display:flex;flex-direction:row;">让小确幸填满你的大生活</div>';
    html += '<div style="position:absolute;right:5px;top:5px;"><a href="task.html" style="color:silver;font-size:10px;">帮助</a></div>';
    html += '</div>';
    $("#user").append(html);
    //同时更新broker的nickname及avatarUrl：由于微信不能静默获取，导致broker内缺乏nickname及avatarUrl
    console.log("try to sync broker info.",person);
    $.ajax({
        url:app.config.sx_api+"/mod/broker/rest/sync/"+person._key,
        type:"post",
        data:JSON.stringify({
            nickname: person.nickName,
            avatarUrl:person.avatarUrl
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        success:function(res){
            console.log("sync success.",res);
        },
        error:function(){
            console.log("sync failed.",person);
        }
    });     
}

//更新达人信息：显示达人后台入口
/**
function insertBroker(broker){
    $("#brokerLink").html('<a href="broker/selection.html">生活家后台</a>&nbsp;&nbsp;<a href="publisher/articles.html">流量主后台</a>');
    $("#brokerHint").html("达人级别："+broker.level);
}
//**/

//查询用户徽章：当前方式为根据用户等级显示徽章列表，以高级用户为分界线，低于高级用户显示用户徽章，高于高级用户显示达人徽章
function loadBadges(broker) {
    console.log("try to load badges.");
    util.AJAX(app.config.sx_api+"/mod/badge/rest/badges", function (res) {
        console.log("load broker badges.",res);
        if(broker.level>3){
            for(var i=3;i<=broker.level && i<res.length;i++){
                showBadge(res[i]);
            }
        }else{
            for(var i=0;i<=broker.level && i<res.length;i++){
                showBadge(res[i]);
            }            
        }
    });
}
//显示badge
function showBadge(badge){
    //徽章
    var badgesHtml = "";
    badgesHtml += "<div style='min-width:32px;display:flex;flex-direction:column;align-items:center;margin:0 2px;'>";
    badgesHtml += "<div><img src='images/badge/"+(badge.icon?badge.icon:(badge.key+".png"))+"' style='width:32px;height:32px;object-fit:cover;'/></div>";
    badgesHtml += "<div style='text-align:center;font-size:9px;color:#fff;'><span>"+badge.name+"</span></div>";
    badgesHtml += "</div>";

    $("#brokerHint").append(badgesHtml);
}

//对于达人显示勋章及贡献度
function insertBroker(broker){

    //徽章
    loadBadges(broker);

    //贡献度
    $("#brokerLink").empty();
    $("#brokerLink").append('<div style="border:1px solid #E5F0FC;background-color:#E5F0FC;color:#3070E8;font-size:10px;font-weight:bold;border-radius:10px;padding:2px 5px;display:flex;justify-content:center;align-items:center;"><div><img src="images/icon/points.png" style="width:12px;height:12px;object-fit:cover;"/></div>&nbsp;<div>贡献度 : '+(broker.points&&broker.points>0?broker.points:0)+'</div></div>');

    //收益
    $("#brokerLink").append('&nbsp;<div style="border:1px solid #f6d0ca;background-color:#f6d0ca;color:#b80010;font-size:10px;font-weight:bold;border-radius:10px;padding:2px 5px;display:flex;justify-content:center;align-items:center;"><div><img src="images/icon/coins.png" style="width:12px;height:12px;object-fit:cover;"/></div>&nbsp;<div id="totalMoney">总收益 : 0</div></div>');
    getMoney(broker.id); 
}

//查询达人收益
function getMoney(brokerId) {
    console.log("try to load broker money info by brokerId.",brokerId);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/money/"+brokerId, function (res) {
        console.log("load broker money info.",brokerId,res);
        $("#totalMoney").empty();
        $("#totalMoney").append("总收益："+Number(res.totalAmount.toFixed(1)));
    });
}

//生成UUID
function getUUID() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

//生成短码
function generateShortCode(url){
    var chars = "0123456789abcdefghigklmnopqrstuvwxyzABCDEFGHIGKLMNOPQRSTUVWXYZ".split("");
    var hashCode = hex_md5(url);//根据原始URL等到hash
    var codeArray = [];
    for(var i=0;i<4;i++){//将hash值分解为4段，分别处理
        var subStr = hashCode.substr(i*8,8);
        //console.log("try generate hash code.",hashCode,subStr);
        var subHexNumber = 0x3FFFFFFF & parseInt(subStr,16);//得到前30位
        var outChars = "";
        for(var j=0;j<6;j++){//循环获得每组6位的字符串
            var index = 0x0000003D & subHexNumber;
            outChars += chars[index];
            subHexNumber = subHexNumber>>5;//每次移动5位
        }
        codeArray.push(outChars);
    }
    console.log("got short codes.",codeArray);
    return codeArray[new Date().getTime()%4];//随机返回一个
}

//存储短码到数据库
function saveShortCode(eventId, itemKey, fromBroker, fromUser, channel, longUrl, shortCode){
  var q = "insert into ilife.urls values ('"+eventId+"','"+itemKey+"','"+fromBroker+"','"+fromUser+"','"+channel+"','"+longUrl+"','"+shortCode+"',now())";
  console.log("try to save short code.",q);
  jQuery.ajax({
    url:app.config.analyze_api+"?query="+q,
    type:"post",
    //data:{},
    headers:{
      "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
    },         
    success:function(json){
      console.log("===short code saved.===\n",json);
    }
  });    
}