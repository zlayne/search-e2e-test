/** *****************************************************************************
 * Licensed Materials - Property of Red Hat, Inc.
 * Copyright (c) 2020 Red Hat, Inc.
 ****************************************************************************** */

/// <reference types="cypress" />

import { clustersPage } from '../views/clusters'
import { deploymentDetailPage } from '../views/deploymentDetailPage'
import { podDetailPage } from '../views/podDetailPage'
import { resourcePage } from '../views/resource'
import { pageLoader, searchPage, searchBar } from '../views/search'

const clusterModes = [{ label: 'Local', valueFn: () => cy.wrap('local-cluster') }, 
                      { label: 'Managed', valueFn: () => clustersPage.givenManagedCluster() }];

clusterModes.forEach((clusterMode) =>   {

  if (clusterMode.skip) {
    return;
  }

  describe('Search in ' + clusterMode.label + ' Cluster', function() {

    before(function() {
      cy.login()
      clusterMode.valueFn().as('clusterName')
      cy.generateNamespace().as('namespace')
      searchPage.whenGoToSearchPage()
    })
  
    after(function() {
      cy.logout()
    })
  
    it('should load the search page', function() {
      pageLoader.shouldNotExist()
      searchPage.shouldExist()
    })
  
    it('should not see any cluster and namespace', function() {
      // when
      searchBar.whenFocusSearchBar()
      searchBar.whenFilterByClusterAndNamespace(this.clusterName, this.namespace)
      // then
      searchPage.shouldFindNoResults()
    })
  
    describe('create namespace and deployment resources', function() {
      before(function() {
        // searchPage.whenGoToSearchPage()
        searchPage.whenGoToWelcomePage() // WORKAROUND for https://github.com/open-cluster-management/backlog/issues/5725
        // given namespace
        resourcePage.whenGoToResourcePage()
        resourcePage.whenSelectTargetCluster(this.clusterName)
        resourcePage.whenCreateNamespace(this.namespace)
  
        // given deployment
        resourcePage.whenGoToResourcePage()
        resourcePage.whenSelectTargetCluster(this.clusterName)
        resourcePage.whenCreateDeployment(this.namespace, this.namespace + '-deployment', 'openshift/hello-openshift')
      })
  
      beforeEach(function() {
        searchPage.whenGoToSearchPage()
        searchBar.whenFilterByClusterAndNamespace(this.clusterName, this.namespace)
      })

      after(function() {
        searchPage.whenDeleteNamespace(this.namespace, { ignoreIfDoesNotExist: true })
      })
  
      it('should have expected count of resource tiles', function() {
        searchPage.whenWaitUntilFindResults()
        searchPage.whenExpandQuickFilters()
        searchPage.shouldFindQuickFilter('cluster', '1')
        searchPage.shouldFindQuickFilter('deployment', '1')
        searchPage.shouldFindQuickFilter('pod', '1')
      });
    
      it('should work kind filter for deployment', function() {
        searchBar.whenFilterByKind('deployment')
        searchPage.shouldFindResourceDetailItem('deployment', this.namespace + '-deployment')
      });
  
      it('should work kind filter for pod', function() {
        searchBar.whenFilterByKind('pod')
        searchPage.shouldFindResourceDetailItem('pod', this.namespace + '-deployment-')
      });
  
      it('should see pod logs', function() {
        searchBar.whenFilterByKind('pod')
        searchPage.whenGoToResourceDetailItemPage('pod', this.namespace + '-deployment-')
        podDetailPage.whenClickOnLogsTag()
        podDetailPage.shouldSeeLogs('serving on')
      });
  
      it('should delete pod', function() {
        searchBar.whenFilterByKind('pod')
        searchPage.whenDeleteResourceDetailItem('pod', this.namespace + '-deployment')
        
        searchPage.shouldBeResourceDetailItemCreatedFewSecondsAgo('pod', this.namespace + '-deployment')
      });
  
      it('should scale deployment', function() {
        searchBar.whenFilterByKind('deployment')
        searchPage.whenGoToResourceDetailItemPage('deployment', this.namespace + '-deployment')
        deploymentDetailPage.whenScaleReplicasTo(2)
        cy.go('back')
  
        searchPage.shouldFindQuickFilter('pod', '2')
      })
  
      it('should delete deployment', function() {
        searchBar.whenFilterByKind('deployment')
        searchPage.whenDeleteResourceDetailItem('deployment', this.namespace + '-deployment')
    
        searchPage.shouldFindNoResults()
      });
  
      it('should delete namespace', function() {
        searchPage.whenDeleteNamespace(this.namespace)

        searchPage.shouldFindNoResults()
      });
    })
    
  })
});