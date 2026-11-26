// What a right count means at IHBAS, for the finish screens of the six IHBAS papers (every mock id starting "ihbas-":
// Mocks 1-2, 2025, 2024, 2024-d, 2020). The site scores +1 / -0.25 everywhere; IHBAS itself has no negative marking,
// so the IHBAS score is the right count. D25 = the Sep 2025 result, marks -> candidates (all 1,647, off the DU
// rank-wise list); same table as ihbas-cutoff/index.html.
(function () {
  var D25 = {95:10,94:7,93:13,92:16,91:36,90:28,89:41,88:49,87:43,86:49,85:49,84:48,83:46,82:47,81:40,80:47,79:31,78:31,77:45,76:49,75:39,74:38,73:49,72:44,71:34,70:35,69:34,68:26,67:35,66:32,65:37,64:28,63:35,62:27,61:31,60:30,59:24,58:26,57:21,56:29,55:21,54:17,53:18,52:20,51:20,50:11,49:19,48:19,47:12,46:10,45:11,44:16,43:4,42:9,41:5,40:14,39:10,38:4,37:5,36:4,35:4,34:5,31:2,29:3,26:1,24:1,23:2,21:1};
  var N25 = 1647;
  window.ihbasLine = function (id, right, N) {
    if (String(id).indexOf("ihbas-") !== 0) return "";
    var s = "IHBAS has no negative marking, so your IHBAS score is " + right + " / " + N + ".";
    if (N !== 100) return s;
    var a = 0, n = D25[right] || 0;
    for (var k in D25) if (+k > right) a += D25[k];
    if (right > 95) s += " That beats everyone in 2025 (top was 95).";
    else if (a === N25) s += " That is below everyone in 2025 (lowest was 21).";
    else if (!n) s += " Nobody got exactly " + right + " in 2025; it sits right after rank " + a + " of 1,647.";
    else s += " In 2025, " + right + " was rank " + (a + 1) + (n > 1 ? " to " + (a + n) : "") + " of 1,647.";
    return s + " The last UR seat went at 94.";
  };
})();
