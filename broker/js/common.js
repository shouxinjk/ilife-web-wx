//显示顶部用户信息
function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="info-general">';
    html += '<img class="general-icon" src="'+person.avatarUrl+'" height="60px"/>';
    html += '</div>';
    html += '<div class="info-detail">';
    html += '<div class="info-text info-blank">'+person.nickName+'</div>';
    html += '<div class="info-text info-blank" id="brokerHint">'+(person.province?person.province:"")+(person.city?(" "+person.city):"")+'</div>';
    html += '<div class="info-text info-blank" id="brokerLink"></div>';
    html += '</div>';
    $("#user").append(html);
}

//更新达人信息：显示达人后台入口
function insertBroker(broker){
    $("#brokerLink").html('<a href="../user.html">返回用户后台</a>&nbsp;&nbsp;<a href="../publisher/articles.html">进入流量主后台</a>');
    $("#brokerHint").html("达人级别："+broker.level);
}