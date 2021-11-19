// parse json from google sheet and render schedule html

// const gsheetID = '1AiBjC9YapNJEHgHpqXvNOOVOZO_5h-KDaJQEmtz3jzI'
// const gsheetSheetNum = '1'
// const gSheetURL = `https://spreadsheets.google.com/feeds/cells/${gsheetID}/${gsheetSheetNum}/public/full?alt=json`
const gSheetURL = '/2021/js/schedule.json'
const confDayStart = 14
const confLength = 3
let columns = []
let data = []
const timeslot = [
  "9:30&ndash;10:45am<br/>(EDT)",
  "10:45&ndash;12:00pm<br/>(EDT)",
  "12:00&ndash;1:15pm<br/>(EDT)",
  "1:45&ndash;3pm<br/>(EDT)",
  "3&ndash;4:15pm<br/>(EDT)",
  "4:15&ndash;5:30pm<br/>(EDT)"
]

let $schedule = $('#schedule-view div')

// take google sheet json feed and return row objects
// with column header keys
function parseGoogleSheetsJSONFeed(data) {
  const sheet = {}
  let rows = []

  sheet.rows = data.feed.entry
  sheet.cols = sheet.rows
      .filter( d => d.gs$cell.row == 1)
      .map( d => d.gs$cell.$t )
  sheet.numRows = Number(sheet.rows[sheet.rows.length - 1].gs$cell.row)

  columns = sheet.cols

  for (let i = 2; i <= sheet.numRows; i++) {
    let row = {}
    let cells = sheet.rows
        .filter(d => d.gs$cell.row == i)
        .map(d => d.gs$cell)
    
    sheet.cols.forEach( (d,i) => {
      row[d] = cells
          .filter(d => Number(d.col) == i + 1)
          .map(d => d.$t)[0]
    })

    rows.push(row)
  }
  return rows
}

// returns transformed row objects to schedule data organized
// by day, session, and presentation
function transformToSchedule(data){
  let daySessions = []
  let presentations = getPresentations(data)
  let sessions = getSessions(presentations)

  for (let i = 0; i < confLength; i++ ){
    daySessions.push(
      sessions.filter( 
        d => d[0].session_id.substring(0,2) == confDayStart + i
    ))
  }
  return daySessions
}

// return array of transformed unique presentations
function getPresentations(data) {
  let presentations = []
  let presentationIDs = getUniqueKeys(data, 'id')

  function transformPresentation(presentation){
    let currPresentation = {}

    for (let column of columns){
      currPresentation[column] = []
      for(row of presentation) { 
        currPresentation[column].push(row[column] || null)
      }
      if( columns.indexOf(column) < 6) { 
          currPresentation[column] = currPresentation[column][0] 
      }
    }

    currPresentation.presenters = getPresenters(currPresentation)
    currPresentation.links = getLinks(currPresentation)
    return currPresentation
  }

  for (let i of presentationIDs) {
    presentations.push( data.filter( (d) => d.id == i ) )
  }

  presentations = presentations.map( (d) => transformPresentation(d) )
  return presentations
}

// return session array of presentation arrays
function getSessions(presentations) {
  let sessions = []
  let sessionIDs = getUniqueKeys(presentations, 'session_id')

  for( id of sessionIDs) {
    sessions.push(presentations.filter( e => e.session_id == id))
  }
  return sessions
}

// return array of presenters objects
function getPresenters(currSession) {
  let currPresenters = []
  currSession.presenter_name.forEach( (v,i) => {
    if (v !== null ) {
      let currPresenter  = {}
      currPresenter.name = v
      currPresenter.affiliation = (currSession.presenter_affiliation[i]) ?
        currSession.presenter_affiliation[i] : null
      currPresenter.url = (currSession.presenter_url[i]) ?
        currSession.presenter_url[i] : null
      currPresenters.push(currPresenter)
    }
  })

  return currPresenters
}

// return array of transformed supplemental presentation links
function getLinks(currSession) {
  let currLinks = []
  for (link of currSession.presentation_supplemental_link) { 
    currLinks.push(link)
  } 

  return currLinks
}

// return array of uniqe keys
function getUniqueKeys(object, targetKey) {
  let uniqueKeys = []
  for ( elem of object ) { 
    uniqueKeys.push(elem[targetKey]) 
  }

  return [...new Set(uniqueKeys)]

}

$(function(){

  $.getJSON( gSheetURL, (d) => { data = parseGoogleSheetsJSONFeed(d) })
    .then( () => {

      let scheduleData = transformToSchedule(data)

      // for each schedule day, append day, session, 
      // presentation information card and modal
      $schedule.each( (i,e) => {  

        scheduleData[i].forEach( (session) => {
        // return hard coded timeslot strings based on session_id
        let displayTime = ( session[0].session_id.substring(0,2) == '14')
          ? timeslot[ Number(session[0].session_id.slice(-1)[0]) + 1]
          : timeslot[ Number(session[0].session_id.slice(-1)[0]) - 1]

        // create timeslot grid row
        let $timeslot = $(`
          <div class="clearfix">
            <div class="col sm-col sm-col-2">${displayTime}</div>
          <div>
          `)
        if (session[0].presentation_type === 'workshop') {
            // for workshops, add a session block for each concurrent workshop
            for( workshop of session ) {
              $timeslot.append( getSessionBlock([workshop]) )
            }
        } else {
              // for sessions, add one session block
              $timeslot.append( getSessionBlock(session) )  
        }

        function getSessionBlock( session ) {
          let currSession = {}
          currSession.id = session[0].session_id
          currSession.title = session[0].session_title
          currSession.session_moderator = []
          for ( presentation of session ) {
            currSession.session_moderator.push(...presentation.session_moderator)
          }
          currSession.session_moderator = currSession.session_moderator.filter( d => d)

          currSession.presenters = ( session[0].presentation_type == 'workshop' )
          ? session[0].presenters.map( d => d.name ).join(', ')
          : session.map( d => d.presenters.map( 
            d => d.name ).join(', ')
          ).join(', ')

          currSession.colClasses = 
            ( session[0].presentation_type == 'workshop' ) 
            ? "sm-col-3" : "sm-col-9"
          // current session template
          $currSession = $(`
          <a class="session col sm-col ${currSession.colClasses} open-modal" href="#session${currSession.id}" rel="modal:open">
          <h3>${currSession.title}</h3>
          ${(currSession.session_moderator.length) ? '<p>Moderator: ' + currSession.session_moderator[0].split(",")[0] + '</p>': ''}
          <p>${currSession.presenters}</p>
          </a>`)

          $currSessionDetails = $(`
            <div id="session${currSession.id}" class="modal"><span>
              <a href="#" rel="modal:close">Close</a>
              <h4>${currSession.title}</h4>
              <h4>${displayTime}</h4>
              ${(currSession.session_moderator.length) ? '<h4>Moderator:<br/>' + currSession.session_moderator + '</h4>': ''}
            </span></div>
          `)

          $currSessionDetails.append(getDetailsTemplate(session))
          $currSession.append($currSessionDetails)
          return $currSession
        }

      function getDetailsTemplate(session){
        let detailsTemplate = []
        for ( presentation of session ) {
          detailsTemplate.push(`<h5>
          ${presentation.presentation_title || presentation.session_title || ''}
          </h5>`)
          detailsTemplate.push(`<p>${getPresentersTemplate(presentation.presenters)}</p>`)
          detailsTemplate.push(`<p>${marked(presentation.presenter_abstract[0])}</p>`)
          detailsTemplate.push(getPresentationLinksTemplate(presentation.links))
        }
        return detailsTemplate
      }

      // return formatted presenter display string
      // including anchor element if url
      function getPresentersTemplate(presenters) {
        let presentersTemplate = presenters.map(d => 
          `
            ${(d.url) ? '<a href="' + d.url + '">' : ''}
            ${d.name}, ${d.affiliation} 
            ${(d.url) ? '</a>' : ''}
          `.trim()
        ).join('<br/>')
        return presentersTemplate || ''
      }

      // return formatted presentation links
      // including anchor element if url
      function getPresentationLinksTemplate(links) {
        let presentationLinksTemplate = ''
        links = links.filter( d => d)
        if (links.length) {
          presentationLinksTemplate = []
          links.map(d => {
            presentationLinksTemplate.push(marked(`- ${d}`))
            }
          )
          presentationLinksTemplate.unshift('<ul>')
          presentationLinksTemplate.unshift('<h6>Supplemental Links</h6`>')
          presentationLinksTemplate.push('</ul>')
          presentationLinksTemplate = presentationLinksTemplate.join('\n')
        }
        return presentationLinksTemplate
      }

      $(e).append($timeslot).each((i,el)=>{ $(el).removeClass('hide') })
    })
  })

      $('a.open-modal').click(function(event) {
        $(this).modal({ fadeDuration: 250 })
        return false
      })
    })
})